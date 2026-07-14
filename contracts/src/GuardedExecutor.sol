// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title GuardedExecutor
/// @notice On-chain half of Reckon — a transaction seatbelt for Monad.
///
/// @dev HONEST SCOPE. On Monad you pay for the declared `gas_limit`, not the gas used, even on
/// revert. Therefore a contract CANNOT refund gas, and this contract does not pretend to. Its
/// value is twofold:
///
///   1. Bounded, predictable execution. Each call in a batch runs under an explicit per-call gas
///      cap (`call{gas: cap}`), so no single call can run away. That lets the off-chain Reckon SDK
///      declare a tight, correct total gas limit for the whole batch and know it is safe — which
///      is where the actual MON savings come from (declaring the tightest limit that won't fail).
///
///   2. Policy guardrails enforced on-chain, outside any agent's control. A per-caller policy caps
///      value per call and in total, sets a max acceptable gas price, and can restrict targets to
///      an allowlist. These prevent catastrophic value loss and unauthorized actions by a buggy or
///      compromised agent — protection that saves the VALUE at risk, independent of gas.
///
/// EIP-7702 friendly: an EOA can delegate to this implementation; because policy is keyed by
/// `msg.sender`, a self-call from the delegated EOA reads that EOA's own policy.
contract GuardedExecutor {
    struct Call {
        address target;
        uint256 value;
        bytes data;
        /// @dev Per-call forwarded gas cap. 0 means "forward all remaining gas".
        uint256 gasCap;
    }

    struct Result {
        bool success;
        bytes returnData;
        uint256 gasUsed;
    }

    struct Policy {
        uint256 maxValuePerCall;
        uint256 maxTotalValue;
        uint256 maxGasPrice;
        bool useAllowlist;
        bool set;
    }

    mapping(address => Policy) private _policy;
    mapping(address => mapping(address => bool)) private _allowed;

    uint256 private _lock = 1;

    event PolicySet(
        address indexed owner,
        uint256 maxValuePerCall,
        uint256 maxTotalValue,
        uint256 maxGasPrice,
        bool useAllowlist
    );
    event AllowlistSet(address indexed owner, address indexed target, bool allowed);
    event CallExecuted(
        address indexed caller,
        uint256 indexed index,
        address indexed target,
        uint256 value,
        bool success,
        uint256 gasUsed
    );
    event BatchExecuted(address indexed caller, uint256 numCalls, uint256 numFailed, bool atomic);

    error Reentrancy();
    error GasPriceTooHigh(uint256 txGasPrice, uint256 maxGasPrice);
    error ValueExceedsPerCall(uint256 index, uint256 value, uint256 maxValuePerCall);
    error ValueExceedsTotal(uint256 total, uint256 maxTotalValue);
    error TargetNotAllowed(uint256 index, address target);
    error InsufficientValue(uint256 provided, uint256 required);
    error RefundFailed();
    error EmptyBatch();
    error CallReverted(uint256 index);

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @notice Set the caller's execution policy. Zero fields mean "no limit" for that field.
    function setPolicy(Policy calldata p) external {
        _policy[msg.sender] = Policy({
            maxValuePerCall: p.maxValuePerCall,
            maxTotalValue: p.maxTotalValue,
            maxGasPrice: p.maxGasPrice,
            useAllowlist: p.useAllowlist,
            set: true
        });
        emit PolicySet(msg.sender, p.maxValuePerCall, p.maxTotalValue, p.maxGasPrice, p.useAllowlist);
    }

    /// @notice Add or remove a target from the caller's allowlist.
    function setAllowlist(address target, bool allowed) external {
        _allowed[msg.sender][target] = allowed;
        emit AllowlistSet(msg.sender, target, allowed);
    }

    function getPolicy(address owner) external view returns (Policy memory) {
        return _policy[owner];
    }

    function isAllowed(address owner, address target) external view returns (bool) {
        return _allowed[owner][target];
    }

    /// @notice Execute a batch of calls under the caller's policy and per-call gas caps.
    /// @param calls The calls to execute in order.
    /// @param atomic If true, any failed call reverts the whole batch (all-or-nothing). If false,
    ///        failures are recorded and the batch continues (best-effort).
    /// @return results Per-call success flag, return data, and gas used.
    function execute(Call[] calldata calls, bool atomic)
        external
        payable
        nonReentrant
        returns (Result[] memory results)
    {
        uint256 n = calls.length;
        if (n == 0) revert EmptyBatch();

        Policy memory p = _policy[msg.sender];

        if (p.set && p.maxGasPrice != 0 && tx.gasprice > p.maxGasPrice) {
            revert GasPriceTooHigh(tx.gasprice, p.maxGasPrice);
        }

        // Pre-sum intended value and enforce value policy up front, so we never send anything
        // before knowing the whole batch is within policy and funded.
        uint256 totalValue;
        for (uint256 i; i < n; ++i) {
            uint256 v = calls[i].value;
            if (p.set && p.maxValuePerCall != 0 && v > p.maxValuePerCall) {
                revert ValueExceedsPerCall(i, v, p.maxValuePerCall);
            }
            totalValue += v;
        }
        if (p.set && p.maxTotalValue != 0 && totalValue > p.maxTotalValue) {
            revert ValueExceedsTotal(totalValue, p.maxTotalValue);
        }
        if (msg.value < totalValue) revert InsufficientValue(msg.value, totalValue);

        results = new Result[](n);
        uint256 numFailed;
        uint256 spent;

        for (uint256 i; i < n; ++i) {
            Call calldata c = calls[i];
            if (p.set && p.useAllowlist && !_allowed[msg.sender][c.target]) {
                revert TargetNotAllowed(i, c.target);
            }

            uint256 gasCap = c.gasCap == 0 ? gasleft() : c.gasCap;
            uint256 g0 = gasleft();
            (bool ok, bytes memory ret) = c.target.call{value: c.value, gas: gasCap}(c.data);
            uint256 used = g0 - gasleft();

            results[i] = Result({success: ok, returnData: ret, gasUsed: used});
            emit CallExecuted(msg.sender, i, c.target, c.value, ok, used);

            if (ok) {
                spent += c.value;
            } else {
                if (atomic) revert CallReverted(i);
                unchecked {
                    ++numFailed;
                }
            }
        }

        // Refund any value not actually sent (unspent budget + value of failed calls).
        uint256 refund = msg.value - spent;
        if (refund > 0) {
            (bool r,) = msg.sender.call{value: refund}("");
            if (!r) revert RefundFailed();
        }

        emit BatchExecuted(msg.sender, n, numFailed, atomic);
    }

    /// @dev Accept plain MON (e.g. refunds routed back, or funding a 7702 account).
    receive() external payable {}
}
