// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/PaymentLib.sol";

contract PaymentIntentRegistry is Ownable {
    using PaymentLib for PaymentLib.Recipient[];

    mapping(bytes32 => PaymentLib.PaymentIntent) private _intents;
    mapping(bytes32 => PaymentLib.Recipient[]) private _recipients;

    event PaymentIntentCreated(bytes32 indexed intentId, address indexed payer, uint256 amount);
    event StatusUpdated(bytes32 indexed intentId, PaymentLib.Status newStatus);

    error IntentAlreadyExists(bytes32 intentId);
    error IntentNotFound(bytes32 intentId);
    error InvalidStatusTransition(PaymentLib.Status current, PaymentLib.Status next);
    error DeadlineInPast();

    constructor() Ownable(msg.sender) {}

    function createIntent(
        address token,
        uint256 amount,
        PaymentLib.Recipient[] calldata recipients,
        uint256 deadline,
        string calldata context
    ) external returns (bytes32 intentId) {
        if (deadline <= block.timestamp) revert DeadlineInPast();
        PaymentLib.validateBps(recipients);

        intentId = keccak256(
            abi.encodePacked(msg.sender, token, amount, block.timestamp, block.prevrandao)
        );
        if (_intents[intentId].createdAt != 0) revert IntentAlreadyExists(intentId);

        PaymentLib.PaymentIntent storage intent = _intents[intentId];
        intent.intentId = intentId;
        intent.payer = msg.sender;
        intent.token = token;
        intent.amount = amount;
        intent.status = PaymentLib.Status.CREATED;
        intent.createdAt = block.timestamp;
        intent.deadline = deadline;
        intent.context = context;

        for (uint256 i; i < recipients.length; ++i) {
            _recipients[intentId].push(recipients[i]);
        }

        emit PaymentIntentCreated(intentId, msg.sender, amount);
        emit StatusUpdated(intentId, PaymentLib.Status.CREATED);
    }

    function updateStatus(bytes32 intentId, PaymentLib.Status newStatus) external onlyOwner {
        PaymentLib.PaymentIntent storage intent = _intents[intentId];
        if (intent.createdAt == 0) revert IntentNotFound(intentId);
        _validateTransition(intent.status, newStatus);
        intent.status = newStatus;
        emit StatusUpdated(intentId, newStatus);
    }

    function getIntent(bytes32 intentId) external view returns (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients) {
        if (_intents[intentId].createdAt == 0) revert IntentNotFound(intentId);
        intent = _intents[intentId];
        recipients = _recipients[intentId];
    }

    function getStatus(bytes32 intentId) external view returns (PaymentLib.Status) {
        if (_intents[intentId].createdAt == 0) revert IntentNotFound(intentId);
        return _intents[intentId].status;
    }

    function _validateTransition(PaymentLib.Status current, PaymentLib.Status next) internal pure {
        if (current == PaymentLib.Status.CREATED && next == PaymentLib.Status.PLANNED) return;
        if (current == PaymentLib.Status.PLANNED && next == PaymentLib.Status.EXECUTOR_SELECTED) return;
        if (current == PaymentLib.Status.EXECUTOR_SELECTED && next == PaymentLib.Status.SETTLED) return;
        if (current == PaymentLib.Status.SETTLED && next == PaymentLib.Status.VERIFIED) return;
        if (
            (current == PaymentLib.Status.CREATED ||
             current == PaymentLib.Status.PLANNED ||
             current == PaymentLib.Status.EXECUTOR_SELECTED) &&
            next == PaymentLib.Status.FAILED
        ) return;
        revert InvalidStatusTransition(current, next);
    }
}
