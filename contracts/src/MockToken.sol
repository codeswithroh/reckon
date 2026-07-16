// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title MockToken
/// @notice A minimal ERC-20 used purely as a live, verifiable demo target for Reckon's
/// approval-risk detection (see packages/core/src/riskDetection.ts). It exists so the dashboard's
/// "unlimited approval" preset calls a real, deployed `approve()` that genuinely succeeds
/// on-chain — not a call that reverts for an unrelated reason (e.g. hitting a contract with no
/// matching function). No production value; this is intentionally the simplest correct ERC-20
/// subset (approve/transfer/balanceOf/allowance) needed for that demo to be honest.
contract MockToken {
    string public constant name = "Reckon Demo Token";
    string public constant symbol = "RCKN";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 initialSupply) {
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
