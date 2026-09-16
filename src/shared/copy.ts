// Every user-facing string that carries meaning. Source: plan/design.md §4–§6
// and the voice rule in PRODUCT.md — bank declines say "your bank"; our own
// failures say "we" and lead with "nothing has been charged". Raw codes are
// never printed.

export type DeclineReason =
  | 'generic'
  | 'insufficient_funds'
  | 'lost_or_stolen'
  | 'expired_card'
  | 'incorrect_cvc'
  | 'processing_error'
  | 'network_unreachable'

interface EmptyCopy {
  title: string
  fact: string
  action: string
}

interface DeclineCopy {
  message: string
  action: string
}

export const COPY = {
  hold: "The seller isn't paid until they ship. If it doesn't arrive as described, open a dispute and we can refund you.",

  empty: {
    noResults: {
      title: 'No listings match',
      fact: 'Try searching by cert number.',
      action: 'Clear filters',
    },
    cart: {
      title: 'Your cart is empty',
      fact: 'Every listing here is one of one.',
      action: 'Browse',
    },
    listings: {
      title: 'No listings yet',
      fact: 'Graded coins and slabbed cards sell fastest.',
      action: 'Create a listing',
    },
    orders: {
      title: 'No orders yet',
      fact: "The seller isn't paid until they ship.",
      action: 'Browse',
    },
    sales: {
      title: 'No sales yet',
      fact: 'When someone buys, you ship directly — funds become available when you mark it shipped.',
      action: 'List an item',
    },
    balance: {
      title: 'No balance yet',
      fact: 'Sold → Shipped → Available.',
      action: 'List an item',
    },
  } satisfies Record<string, EmptyCopy>,

  checkout: {
    submitting: 'Sending your payment…',
    threeDs: "Your bank needs to confirm it's you. You'll come right back.",
    confirming: 'Confirming your payment…',
    processing: "Payment sent — waiting on your bank. You don't need to do anything.",
    softDecline:
      'Your bank declined this payment. Your details are still here — check the card and try again.',
    hardDecline: 'Your bank declined this card. Try a different card.',
    ambiguous: {
      title: "We're not sure whether that went through. Don't pay again yet.",
      reference: 'Reference',
      action: 'Check again',
    },
    succeeded: "Payment complete. We're holding it until the seller ships.",
  },

  decline: {
    generic: {
      message: 'Your bank declined this payment.',
      action: 'Try a different card',
    },
    insufficient_funds: {
      message: 'Your bank declined this payment for insufficient funds.',
      action: 'Try a different card',
    },
    lost_or_stolen: {
      message: 'Your bank declined this card.',
      action: 'Try a different card',
    },
    expired_card: {
      message: 'Your bank says this card has expired.',
      action: 'Try a different card',
    },
    incorrect_cvc: {
      message: "Your bank couldn't match the security code.",
      action: 'Check the code and try again',
    },
    processing_error: {
      message: 'Nothing has been charged. We hit a problem processing this payment.',
      action: 'Try again',
    },
    network_unreachable: {
      message: "Nothing has been charged. We couldn't reach the payment network.",
      action: 'Try again',
    },
  } satisfies Record<DeclineReason, DeclineCopy>,

  postPayment: {
    actionDidNotSave: "That didn't save — try again.",
    refundFailed:
      'No money has moved. The dispute is still open, and you can retry the refund.',
    refundSucceeded: "Refunded. The seller's balance has been reversed.",
  },

  orderActions: {
    ship: 'Mark shipped',
    receive: 'Mark received',
    dispute: 'Dispute',
    refund: 'Refund',
    disputeConfirm: 'Open a dispute? The seller stays unpaid while Slabbed reviews it.',
  },
} as const
