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
    paypalUnfinished: "You didn't finish paying on PayPal. Nothing has been charged.",
    confirming: 'Confirming your payment…',
    processing: "Payment sent — waiting on your bank. You don't need to do anything.",
    softDecline: 'Your cart and address are saved, so you can try again.',
    hardDecline: "This card won't work for this order. Your cart is saved.",
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
      action: 'Try again',
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
    /** No dispute on the order. */
    refundFailed: 'No money has moved. You can retry the refund.',
    refundFailedDispute:
      'No money has moved. The dispute is still open, and you can retry the refund.',
    refundSucceeded: "Refunded. The seller's balance has been reversed.",
    /** Buyer-facing: where the money goes, not the seller's ledger. */
    refundSucceededBuyer:
      'Refunded in full to your original payment method. Your bank may take a few days to show it.',
  },

  orderActions: {
    ship: 'Mark shipped',
    receive: 'Mark received',
    dispute: 'Dispute',
    refund: 'Refund',
    disputeConfirm: 'Open a dispute? The seller stays unpaid while Slabbed reviews it.',
  },

  // ── Shared across pages ───────────────────────────────────────────────────

  common: {
    tryAgain: 'Try again',
    cancel: 'Cancel',
    saving: 'Saving…',
    freeShipping: 'Free shipping',
    plusShipping: 'shipping',
    shipsFrom: 'Ships from',
    reference: 'Reference',
    switchToCollector: 'Switch to Alex or Mike in the top bar.',
  },

  refundPill: {
    pending: 'Refund pending',
    failed: 'Refund failed',
  },

  shell: {
    wordmark: 'Slabbed',
    searchLabel: 'Search listings',
    searchPlaceholder: 'Search by title, grade or cert number',
    signedInAs: 'Signed in as',
    cart: 'Cart',
    shop: 'Shop',
    orders: 'Orders',
    sell: 'Sell',
    admin: 'Admin',
    footer:
      'A demo marketplace. Sellers, listings, photos and ratings are synthetic; payments are real Hyperswitch sandbox payments.',
    signIn: 'Sign in',
    signOut: 'Sign out',
    switchAccount: 'Switch demo account',
    reset: 'Reset demo',
    resetBody:
      "Clears this browser's cart, created listings, sold markers and sign-in. Real sandbox orders are never touched.",
  },

  signIn: {
    title: 'Sign in',
    demo: 'This is a demo sign-in. No real account is created or used.',
    providers: {
      google: 'Continue with Google',
      apple: 'Continue with Apple',
      email: 'Continue with email',
    },
    providerName: { google: 'Google', apple: 'Apple' },
    stepHeader: (provider: string) => `${provider} (demo)`,
    demoLabel: 'Demo — no real account is used',
    choose: 'Choose an account to continue to Slabbed',
    consentIntro: 'Slabbed will receive:',
    consentItems: ['Your name', 'Your email address'],
    cancel: 'Cancel',
    continue: 'Continue',
    redirecting: 'Redirecting back to Slabbed…',
    emailTitle: 'Continue with email',
    emailLabel: 'Email address',
    emailHint: 'Use one of the demo emails.',
    unknownEmail: 'That isn’t a demo account. Use one of:',
    back: 'Back to sign-in options',
  },

  sold: {
    label: 'Sold',
    listing: 'This one-of-one item has sold.',
    cartLine: 'No longer available to buy.',
    groupAllSold: 'Everything from this seller has sold.',
  },

  catalogue: {
    chips: {
      coin: 'Coins',
      card: 'Cards',
      graded: 'Graded',
      raw: 'Raw',
      free: 'Free shipping',
    },
    of: 'of',
    for: 'for',
    allListings: 'All listings',
  },

  listing: {
    raw: 'Raw',
    rawLong: 'Raw (ungraded)',
    notFoundTitle: 'Listing not found',
    notFound: "This listing isn't here",
    notFoundFact: 'The link may be wrong, or the listing was created in another browser.',
    back: 'Back to listings',
    cert: 'Cert',
    buyNow: 'Buy now',
    addToCart: 'Add to cart',
    inCart: 'In cart — view cart',
    own: 'This is your listing.',
    ownLink: 'See it on your seller page',
    adminCantBuy: "Admins can't buy. Switch to a collector to buy this.",
    details: 'Details',
    seller: 'Seller',
    rating: 'rating',
    sale: 'sale',
    joined: 'Joined',
    specs: {
      service: 'Grading service',
      grade: 'Grade',
      cert: 'Cert number',
      year: 'Year',
      mintMark: 'Mint mark',
      category: 'Category',
    },
    coin: 'Coin',
    card: 'Card',
  },

  cart: {
    title: 'Cart',
    manySellers: (n: number) =>
      `Items from ${n} sellers. Each seller is checked out and paid separately.`,
    oneSeller: 'Each seller is checked out and paid separately.',
    remove: 'Remove',
    qty: 'Qty',
    items: 'Items',
    shipping: 'Shipping',
    subtotal: 'Subtotal',
    taxLater: 'Sales tax is added at checkout.',
    own: "This is your listing — you can't buy it.",
    admin: "Admins can't buy. Switch to a collector to check out.",
    checkOutWith: (handle: string) => `Check out with ${handle}`,
  },

  checkoutPage: {
    title: 'Checkout',
    emptyGroup: 'Nothing from this seller in your cart',
    backToCart: 'Back to cart',
    ownListing: "You can't buy your own listing",
    ownListingBody: 'Switch to another collector in the top bar to buy it.',
    admin: 'Admins don’t check out',
    adminBody: 'Switch to Alex or Mike in the top bar to buy.',
    shipTo: 'Ship to',
    fields: { name: 'Name', line1: 'Address', city: 'City', state: 'State', zip: 'ZIP' },
    continue: 'Continue to payment',
    starting: 'Starting…',
    payment: 'Payment',
    summary: 'Summary',
    from: 'From',
    items: 'Items',
    shipping: 'Shipping',
    tax: 'Tax',
    total: 'Total',
    startFailed: "Nothing has been charged. We couldn't start this payment — try again.",
  },

  order: {
    title: 'Order',
    notFound: "We couldn't find this order",
    notFoundFact: 'Orders are read straight from the payment record, by reference.',
    toOrders: 'Your orders',
    paymentFailed: "Payment didn't go through",
    supportRef: 'Support ref',
    review: 'This payment is being reviewed',
    reviewBody: "Don't pay again. We'll update this order when the review finishes.",
    cancelled: 'This payment was cancelled. Nothing has been charged.',
    other: "This payment needs a look from us. Don't pay again.",
    items: 'Items',
    amounts: 'Amounts',
    yourSale: 'Your sale',
    gross: 'Items + shipping',
    commission: 'Commission',
    refunded: 'Refunded to buyer',
    net: 'You receive',
    progress: 'Progress',
    steps: {
      paid: 'Paid',
      shipped: 'Shipped',
      received: 'Received',
      disputed: 'Disputed',
      refunded: 'Refunded',
    },
    refund: 'Refund',
    disputeReason: 'Reason (optional)',
  },

  orders: {
    title: 'Your orders',
    loadFailed: "We couldn't load your orders.",
    loadFailedFact: 'Your payments are unaffected. This only failed to read them.',
    loading: 'Loading orders',
    gone: 'Listing no longer available',
    more: (n: number) => ` + ${n} more`,
  },

  sell: {
    title: 'Selling',
    adminOnly: 'Selling is for collector accounts',
    adminFact: 'Switch to Alex or Mike to list items and ship sales.',
    listings: 'Your listings',
    newListing: 'Create a listing',
    sales: 'Your sales',
    loading: 'Loading sales…',
    boughtBy: 'Bought by',
    balance: 'Balance',
    loadFailed: "We couldn't load your sales.",
    loadFailedFact: 'Nothing has changed. Check your connection and try again.',
    noPayouts: 'Payouts to PayPal or a bank are not part of this demo.',
    gross: 'Gross (items + shipping)',
    grossShort: 'Gross',
    commission: 'Commission',
    refunded: 'Refunded to buyer',
    net: 'Net',
    expected: ' (expected)',
    pending: 'Pending',
    available: 'Available',
    reversed: 'Reversed',
    pendingBox: 'Pending (expected)',
    notShipped: (n: number) => `${n} ${n === 1 ? 'sale' : 'sales'} not shipped yet`,
    shipped: (n: number) => `${n} shipped ${n === 1 ? 'sale' : 'sales'}`,
    allSales: 'All sales',
    reversedNote: (n: number) =>
      `${n} refunded ${n === 1 ? 'sale' : 'sales'} reversed, not counted.`,
    released: 'Now available',
    balanceLabel: 'Balance',
  },

  sellNew: {
    title: 'Create a listing',
    adminOnly: 'Listings are created by collector accounts',
    adminFact: 'Switch to Alex or Mike to list an item.',
    publish: 'Publish listing',
    fixErrors: 'Check the highlighted fields.',
    category: 'Category',
    listingTitle: 'Title',
    price: 'Price',
    priceHint: 'US dollars',
    shipping: 'Shipping',
    shippingHint: '0 for free shipping',
    year: 'Year',
    optional: 'Optional',
    mintMark: 'Mint mark',
    mintMarkHint: 'Optional, e.g. CC, S, D',
    graded: 'Graded',
    service: 'Service',
    choose: 'Choose',
    grade: 'Grade',
    cert: 'Cert number',
    imageUrl: 'Image URL',
    imageHint: 'Optional. Without one, the listing shows a plain slab outline.',
    description: 'Description',
    errors: {
      title: 'Add a title.',
      price: 'Enter a price in dollars, like 1800 or 24.50.',
      shipping: 'Enter shipping in dollars, or 0 for free shipping.',
      description: 'Add a description.',
      service: 'Choose the grading service.',
      grade: 'Add the grade on the slab.',
      cert: 'Add the cert number on the slab.',
      year: 'Enter a four-digit year.',
    },
  },

  admin: {
    onlyTitle: 'Admin only',
    onlyBody:
      'Switch to Slabbed Admin in the account menu to review transactions and refunds.',
    title: 'Transactions',
    filter: 'Filter transactions',
    all: 'All',
    disputes: 'Disputes',
    loading: 'Loading transactions…',
    loadFailed: "We couldn't load transactions.",
    loadFailedFact: 'Nothing has changed. Check your connection and try again.',
    noDisputes: 'No open disputes.',
    none: 'No transactions yet.',
    columns: [
      'Payment',
      'Date',
      'Buyer',
      'Seller',
      'Amount',
      'Payment state',
      'Fulfilment',
      'Refund',
    ],
  },

  adminPayment: {
    title: 'Payment',
    back: 'All transactions',
    loading: 'Loading payment…',
    loadFailed: "We couldn't load this payment.",
    loadFailedFact: 'Nothing has changed. Check the payment id or try again.',
    disputed: 'The buyer disputed this order',
    disputeResolved: 'Dispute resolved by refund',
    disputedFact:
      'The seller stays unpaid while Slabbed reviews it. Refund the buyer if the item did not arrive as described.',
    disputeReason: 'Buyer’s reason',
    noDisputeReason: 'The buyer gave no reason.',
    refundPending: 'Refund sent — waiting on the connector.',
    refundPendingFact: 'Reload this page to check whether it has settled.',
    refundFailedTitle: 'Refund failed',
    refundDoneTitle: 'Refund complete',
    declinedTitle: 'Payment declined',
    declineCode: 'Decline code',
    retriable: ' · retriable',
    notRetriable: ' · not retriable',
    order: 'Order',
    date: 'Date',
    buyer: 'Buyer',
    seller: 'Seller',
    connector: 'Connector',
    items: 'Items',
    timeline: 'Timeline',
    steps: {
      paid: 'Paid',
      shipped: 'Shipped',
      received: 'Received',
      disputed: 'Disputed',
      refunded: 'Refunded',
    },
    notYet: 'Not yet',
    charged: 'Buyer was charged',
    shipping: 'Shipping',
    tax: 'Sales tax',
    total: 'Total',
    refunded: 'Refunded',
    remaining: 'Remaining',
    ledger: 'Seller ledger',
    gross: 'Gross (items + shipping)',
    commission: 'Commission',
    net: 'Net',
    expected: ' (expected)',
    balance: 'Balance',
    pending: 'Pending',
    available: 'Available',
    reversed: 'Reversed',
    fullRefund: 'Full refund of',
    confirmTitle: (amount: string, buyer: string) => `Refund ${amount} to ${buyer}?`,
    confirmBody:
      "The whole order goes back to the buyer's card and cannot be taken back. The seller's balance for this sale is reversed.",
    refunding: 'Refunding…',
    confirm: (amount: string) => `Refund ${amount}`,
  },
} as const
