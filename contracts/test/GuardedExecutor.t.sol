// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardedExecutor} from "../src/GuardedExecutor.sol";

/// @dev A target that can succeed, hold value, revert, or burn gas on demand.
contract MockTarget {
    uint256 public received;
    uint256 public slot;

    error Boom(string why);

    function ok(uint256 x) external returns (uint256) {
        slot = x;
        return x * 2;
    }

    function deposit() external payable {
        received += msg.value;
    }

    function revertString() external pure {
        revert("nope");
    }

    function revertCustom() external pure {
        revert Boom("custom");
    }

    /// @dev Writes to distinct storage slots in a loop to burn a lot of gas.
    function burnGas(uint256 iterations) external {
        for (uint256 i; i < iterations; ++i) {
            assembly {
                sstore(add(0x1000, i), add(i, 1))
            }
        }
    }
}

/// @dev Calls back into the executor to test the reentrancy guard.
contract Reenterer {
    GuardedExecutor public exec;

    constructor(GuardedExecutor e) {
        exec = e;
    }

    function reenter() external {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = GuardedExecutor.Call({target: address(this), value: 0, data: "", gasCap: 0});
        exec.execute(calls, true);
    }
}

contract GuardedExecutorTest is Test {
    GuardedExecutor internal exec;
    MockTarget internal target;

    address internal alice = address(0xA11CE);

    event CallExecuted(
        address indexed caller,
        uint256 indexed index,
        address indexed target,
        uint256 value,
        bool success,
        uint256 gasUsed
    );
    event BatchExecuted(address indexed caller, uint256 numCalls, uint256 numFailed, bool atomic);

    function setUp() public {
        exec = new GuardedExecutor();
        target = new MockTarget();
        vm.deal(alice, 100 ether);
    }

    function _call(address t, uint256 v, bytes memory d, uint256 cap)
        internal
        pure
        returns (GuardedExecutor.Call memory)
    {
        return GuardedExecutor.Call({target: t, value: v, data: d, gasCap: cap});
    }

    // ----------------------------------------------------------------- success

    function test_executeSingleSuccess() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (21)), 0);

        vm.prank(alice);
        GuardedExecutor.Result[] memory res = exec.execute(calls, true);

        assertEq(res.length, 1);
        assertTrue(res[0].success);
        assertEq(abi.decode(res[0].returnData, (uint256)), 42);
        assertEq(target.slot(), 21);
    }

    function test_executeMultiSuccess() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](2);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (1)), 0);
        calls[1] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (7)), 0);

        vm.prank(alice);
        GuardedExecutor.Result[] memory res = exec.execute(calls, true);

        assertTrue(res[0].success && res[1].success);
        assertEq(target.slot(), 7);
    }

    function test_emitsBatchExecuted() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (1)), 0);

        vm.expectEmit(true, false, false, true);
        emit BatchExecuted(alice, 1, 0, true);
        vm.prank(alice);
        exec.execute(calls, true);
    }

    // -------------------------------------------------------------------- value

    function test_forwardsValueAndRefundsExcess() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.deposit, ()), 0);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        exec.execute{value: 3 ether}(calls, true); // overfund by 2 ether

        assertEq(target.received(), 1 ether);
        // Alice paid exactly 1 ether (2 ether refunded); ignoring gas since foundry tx gas is free here.
        assertEq(alice.balance, balBefore - 1 ether);
    }

    function test_insufficientValueReverts() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 2 ether, abi.encodeCall(MockTarget.deposit, ()), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(GuardedExecutor.InsufficientValue.selector, 1 ether, 2 ether)
        );
        exec.execute{value: 1 ether}(calls, true);
    }

    // ------------------------------------------------------------ failure modes

    function test_atomicBubblesRevert() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.revertString, ()), 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GuardedExecutor.CallReverted.selector, 0));
        exec.execute(calls, true);
    }

    function test_nonAtomicRecordsFailureAndContinues() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](2);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.revertString, ()), 0);
        calls[1] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (9)), 0);

        vm.prank(alice);
        GuardedExecutor.Result[] memory res = exec.execute(calls, false);

        assertFalse(res[0].success);
        assertTrue(res[1].success);
        assertEq(target.slot(), 9); // second call still ran
    }

    function test_nonAtomicRefundsValueOfFailedCall() public {
        // A failing call must not move value; its budget is refunded.
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](2);
        calls[0] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.revertString, ()), 0);
        calls[1] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.deposit, ()), 0);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        exec.execute{value: 2 ether}(calls, false);

        assertEq(target.received(), 1 ether); // only the successful deposit
        assertEq(alice.balance, balBefore - 1 ether); // failed call's 1 ether refunded
    }

    // --------------------------------------------------------------- gas caps

    function test_perCallGasCapBoundsRunawayCall() public {
        // A gas-hungry call under a small cap fails (out of gas), bounded — the batch survives.
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](2);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.burnGas, (1000)), 50_000);
        calls[1] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (5)), 0);

        vm.prank(alice);
        GuardedExecutor.Result[] memory res = exec.execute(calls, false);

        assertFalse(res[0].success, "runaway call should hit its cap and fail");
        assertLt(res[0].gasUsed, 100_000, "capped call must not consume unbounded gas");
        assertTrue(res[1].success, "subsequent call still runs");
    }

    // ----------------------------------------------------------------- policy

    function test_policyMaxValuePerCall() public {
        vm.prank(alice);
        exec.setPolicy(
            GuardedExecutor.Policy({
                maxValuePerCall: 0.5 ether,
                maxTotalValue: 0,
                maxGasPrice: 0,
                useAllowlist: false,
                set: false
            })
        );

        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.deposit, ()), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutor.ValueExceedsPerCall.selector, 0, 1 ether, 0.5 ether
            )
        );
        exec.execute{value: 1 ether}(calls, true);
    }

    function test_policyMaxTotalValue() public {
        vm.prank(alice);
        exec.setPolicy(
            GuardedExecutor.Policy({
                maxValuePerCall: 0,
                maxTotalValue: 1.5 ether,
                maxGasPrice: 0,
                useAllowlist: false,
                set: false
            })
        );

        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](2);
        calls[0] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.deposit, ()), 0);
        calls[1] = _call(address(target), 1 ether, abi.encodeCall(MockTarget.deposit, ()), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(GuardedExecutor.ValueExceedsTotal.selector, 2 ether, 1.5 ether)
        );
        exec.execute{value: 2 ether}(calls, true);
    }

    function test_policyMaxGasPrice() public {
        vm.prank(alice);
        exec.setPolicy(
            GuardedExecutor.Policy({
                maxValuePerCall: 0,
                maxTotalValue: 0,
                maxGasPrice: 100 gwei,
                useAllowlist: false,
                set: false
            })
        );

        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (1)), 0);

        vm.txGasPrice(200 gwei);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(GuardedExecutor.GasPriceTooHigh.selector, 200 gwei, 100 gwei)
        );
        exec.execute(calls, true);
    }

    function test_allowlistBlocksAndPermits() public {
        vm.prank(alice);
        exec.setPolicy(
            GuardedExecutor.Policy({
                maxValuePerCall: 0,
                maxTotalValue: 0,
                maxGasPrice: 0,
                useAllowlist: true,
                set: false
            })
        );

        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(target), 0, abi.encodeCall(MockTarget.ok, (1)), 0);

        // Not allowlisted → blocked.
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(GuardedExecutor.TargetNotAllowed.selector, 0, address(target))
        );
        exec.execute(calls, true);

        // Allowlist it → permitted.
        vm.prank(alice);
        exec.setAllowlist(address(target), true);
        vm.prank(alice);
        GuardedExecutor.Result[] memory res = exec.execute(calls, true);
        assertTrue(res[0].success);
    }

    // ------------------------------------------------------------- guard rails

    function test_reentrancyBlocked() public {
        Reenterer bad = new Reenterer(exec);
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](1);
        calls[0] = _call(address(bad), 0, abi.encodeCall(Reenterer.reenter, ()), 0);

        // Outer call is atomic, inner reenter reverts with Reentrancy() → bubbles as CallReverted.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GuardedExecutor.CallReverted.selector, 0));
        exec.execute(calls, true);
    }

    function test_emptyBatchReverts() public {
        GuardedExecutor.Call[] memory calls = new GuardedExecutor.Call[](0);
        vm.prank(alice);
        vm.expectRevert(GuardedExecutor.EmptyBatch.selector);
        exec.execute(calls, true);
    }

    function test_getPolicyAndAllowlistViews() public {
        vm.prank(alice);
        exec.setPolicy(
            GuardedExecutor.Policy({
                maxValuePerCall: 1 ether,
                maxTotalValue: 2 ether,
                maxGasPrice: 50 gwei,
                useAllowlist: true,
                set: false
            })
        );
        GuardedExecutor.Policy memory p = exec.getPolicy(alice);
        assertEq(p.maxValuePerCall, 1 ether);
        assertEq(p.maxTotalValue, 2 ether);
        assertEq(p.maxGasPrice, 50 gwei);
        assertTrue(p.useAllowlist);
        assertTrue(p.set);

        vm.prank(alice);
        exec.setAllowlist(address(target), true);
        assertTrue(exec.isAllowed(alice, address(target)));
        assertFalse(exec.isAllowed(alice, address(0xdead)));
    }
}
