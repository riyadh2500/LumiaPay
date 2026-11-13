/**
 * LumiaPay Central Payment Engine
 * 
 * Production-ready payment processing system with:
 * - Secure payment intent creation
 * - Blockchain transaction verification
 * - Status lifecycle management
 * - Transaction uniqueness enforcement
 * - Event tracking and audit trails
 * - Comprehensive error handling
 * 
 * @packageDocumentation
 */

// Main service exports
export {
  createPaymentIntent,
  verifyPayment,
  getPaymentById,
  getPaymentsByUser,
  cancelPendingPayment,
} from './payment-service';

// Type exports
export type {
  PaymentStatus,
  PaymentIntent,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  VerificationInput,
  VerificationResult,
  PaymentEvent,
  PaymentEventType,
  BlockchainTransaction,
} from './payment-types';

// Error exports
export {
  PaymentEngineError,
  ValidationError,
  VerificationError,
  TransactionError,
} from './payment-types';

// Validator utilities
export {
  validateAmount,
  compareAmounts,
  calculateAmountDifference,
  validateAddress,
  validateCurrency,
  isExpired,
} from './payment-validator';

// Transaction utilities
export {
  detectTransaction,
  verifySpecificTransaction,
  classifyAmount,
  withRetry,
} from './transaction-verifier';

// Event utilities
export {
  getPaymentEvents,
  emitPaymentCreated,
  emitPaymentPending,
  emitPaymentPaid,
  emitPaymentExpired,
  emitPaymentFailed,
} from './payment-events';

// Lifecycle utilities
export {
  updatePaymentStatus,
  checkAndExpirePayment,
  expirePendingPayments,
  getPayment,
  getUserPayments,
} from './payment-lifecycle';
