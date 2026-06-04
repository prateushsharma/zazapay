// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File contracts/core/AgentRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.30;

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
