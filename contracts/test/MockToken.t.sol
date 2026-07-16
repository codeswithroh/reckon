// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockToken} from "../src/MockToken.sol";

contract MockTokenTest is Test {
    MockToken internal token;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        token = new MockToken(1_000_000 ether);
    }

    function test_initialSupplyMintedToDeployer() public view {
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(address(this)), 1_000_000 ether);
    }

    function test_approveSetsAllowance() public {
        token.approve(alice, 500 ether);
        assertEq(token.allowance(address(this), alice), 500 ether);
    }

    function test_approveUnlimitedSetsMaxUint() public {
        token.approve(alice, type(uint256).max);
        assertEq(token.allowance(address(this), alice), type(uint256).max);
    }

    function test_transferMovesBalance() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
        assertEq(token.balanceOf(address(this)), 1_000_000 ether - 100 ether);
    }

    function test_transferFromRespectsAllowance() public {
        token.approve(alice, 100 ether);
        vm.prank(alice);
        token.transferFrom(address(this), bob, 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
        assertEq(token.allowance(address(this), alice), 0);
    }

    function test_transferFromRevertsWithoutAllowance() public {
        vm.prank(alice);
        vm.expectRevert("insufficient allowance");
        token.transferFrom(address(this), bob, 1 ether);
    }
}
