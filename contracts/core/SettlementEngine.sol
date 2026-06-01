// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/PaymentLib.sol";

interface IAgentRegistry {
    function isActiveAgent(address agent) external view returns (bool);
}

interface IPaymentIntentRegistry {
    function getIntent(bytes32 intentId)
        external
        view
        returns (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients);

    function updateStatus(bytes32 intentId, PaymentLib.Status newStatus) external;
}

contract SettlementEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IAgentRegistry public immutable agentRegistry;
    IPaymentIntentRegistry public immutable paymentIntentRegistry;

    address public receiptRegistry;

    event SettlementExecuted(bytes32 indexed intentId, address indexed executor, uint256 amount);
    event ReceiptRegistrySet(address indexed receiptRegistry);

    error NotActiveAgent();
    error IntentNotExecutable(bytes32 intentId);
    error DeadlineExceeded(bytes32 intentId);
    error AlreadySettled(bytes32 intentId);
    error InvalidBpsTotal(uint256 total);

    modifier onlyActiveAgent() {
        if (!agentRegistry.isActiveAgent(msg.sender)) revert NotActiveAgent();
        _;
    }

    constructor(address _agentRegistry, address _paymentIntentRegistry) Ownable(msg.sender) {
        agentRegistry = IAgentRegistry(_agentRegistry);
        paymentIntentRegistry = IPaymentIntentRegistry(_paymentIntentRegistry);
    }

    function setReceiptRegistry(address _receiptRegistry) external onlyOwner {
        receiptRegistry = _receiptRegistry;
        emit ReceiptRegistrySet(_receiptRegistry);
    }

    function executeSettlement(bytes32 intentId) external nonReentrant onlyActiveAgent {
        (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients) =
            paymentIntentRegistry.getIntent(intentId);

        if (intent.status == PaymentLib.Status.SETTLED) revert AlreadySettled(intentId);
        if (
            intent.status != PaymentLib.Status.EXECUTOR_SELECTED &&
            intent.status != PaymentLib.Status.PLANNED
        ) revert IntentNotExecutable(intentId);
        if (block.timestamp > intent.deadline) revert DeadlineExceeded(intentId);

        uint16 totalBps;
        for (uint256 i = 0; i < recipients.length; i++) {
            totalBps += recipients[i].bps;
        }
        if (totalBps != 10000) revert InvalidBpsTotal(totalBps);

        IERC20 token = IERC20(intent.token);
        uint256 totalAmount = intent.amount;

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (totalAmount * recipients[i].bps) / 10_000;
            token.safeTransferFrom(intent.payer, recipients[i].wallet, share);
        }

        paymentIntentRegistry.updateStatus(intentId, PaymentLib.Status.SETTLED);

        emit SettlementExecuted(intentId, msg.sender, totalAmount);
    }
}
