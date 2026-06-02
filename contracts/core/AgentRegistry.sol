// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    struct Agent {
        address wallet;
        string role;
        bool active;
        uint256 heartbeatAt;
        uint256 successCount;
        uint256 failCount;
    }

    mapping(address => Agent) private _agents;
    address[] private _agentList;

    event AgentRegistered(address indexed wallet, string role);
    event AgentDeactivated(address indexed wallet);
    event HeartbeatRecorded(address indexed wallet, uint256 timestamp);
    event AgentStatUpdated(address indexed wallet, bool success);

    error AgentAlreadyRegistered(address wallet);
    error AgentNotFound(address wallet);

    constructor() Ownable(msg.sender) {}

    function registerAgent(address wallet, string calldata role) external onlyOwner {
        if (_agents[wallet].wallet != address(0)) revert AgentAlreadyRegistered(wallet);
        _agents[wallet] = Agent({
            wallet: wallet,
            role: role,
            active: true,
            heartbeatAt: block.timestamp,
            successCount: 0,
            failCount: 0
        });
        _agentList.push(wallet);
        emit AgentRegistered(wallet, role);
    }

    function deactivateAgent(address wallet) external onlyOwner {
        if (_agents[wallet].wallet == address(0)) revert AgentNotFound(wallet);
        _agents[wallet].active = false;
        emit AgentDeactivated(wallet);
    }

    function recordHeartbeat(address wallet) external {
        if (_agents[wallet].wallet == address(0)) revert AgentNotFound(wallet);
        _agents[wallet].heartbeatAt = block.timestamp;
        emit HeartbeatRecorded(wallet, block.timestamp);
    }

    function recordOutcome(address wallet, bool success) external {
        if (_agents[wallet].wallet == address(0)) revert AgentNotFound(wallet);
        if (success) {
            _agents[wallet].successCount += 1;
        } else {
            _agents[wallet].failCount += 1;
        }
        emit AgentStatUpdated(wallet, success);
    }

    function getAgent(address wallet) external view returns (Agent memory) {
        if (_agents[wallet].wallet == address(0)) revert AgentNotFound(wallet);
        return _agents[wallet];
    }

    function isActiveAgent(address wallet) external view returns (bool) {
        return _agents[wallet].active;
    }

    function getAllAgents() external view returns (address[] memory) {
        return _agentList;
    }

    function getActiveExecutors() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _agentList.length; i++) {
            Agent storage a = _agents[_agentList[i]];
            if (a.active && keccak256(bytes(a.role)) == keccak256(bytes("executor"))) {
                count++;
            }
        }
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _agentList.length; i++) {
            Agent storage a = _agents[_agentList[i]];
            if (a.active && keccak256(bytes(a.role)) == keccak256(bytes("executor"))) {
                result[idx++] = _agentList[i];
            }
        }
        return result;
    }
}
