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
  hold: "The seller isn't paid until they ship. If something's wrong, ask the seller for a refund from the order page.",

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
      title: 'Nothing listed yet',
      fact: 'List a graded coin or slabbed card with its cert number, price and shipping. It goes live in the shop as soon as you publish.',
      action: 'Create a listing',
    },
    orders: {
      title: 'No orders yet',
      fact: "The seller isn't paid until they ship.",
      action: 'Browse',
    },
    sales: {
      title: 'No sales yet',
      fact: 'When a buyer checks out, the sale shows up here with their shipping details. Ship it, mark it shipped, and your earnings are released.',
      action: 'List an item',
    },
    balance: {
      title: 'No earnings yet',
      fact: 'A sale counts as pending until you ship it. Once it is marked shipped, the price plus shipping, minus 5% commission, becomes available.',
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
    /** Buyer-facing: where the money goes, not the seller's ledger. */
    refundSucceededBuyer:
      'Refunded in full to your original payment method. Your bank may take a few days to show it.',
  },

  orderActions: {
    ship: 'Mark shipped',
    receive: 'Mark received',
    refund: 'Refund',
    haveIssue: 'Have an issue?',
    whatsWrong: "What's wrong?",
    issues: {
      notShipped: "It hasn't shipped",
      notArrived: "It hasn't arrived",
      wrongItem: "Something's wrong with my item",
    },
    issueHint:
      'Tell the seller what happened. They stay unpaid until they answer your request.',
    details: 'Details (optional)',
    requestRefund: 'Request refund',
    refundRequested:
      "Refund requested. The seller reviews it and stays unpaid until it's resolved.",
    sellerRequest: 'The buyer asked for a refund',
    sellerRequestFact: 'You stay unpaid for this sale until you refund it.',
    noReason: 'The buyer gave no reason.',
    refundBuyer: 'Refund buyer',
    refundTitle: (amount: string, buyer: string) => `Refund ${amount} to ${buyer}?`,
    refundBody:
      "The buyer's whole order from you goes back to how they paid. It can't be undone, and this sale pays you nothing.",
    refunding: 'Refunding…',
    refundConfirm: (amount: string) => `Refund ${amount}`,
    refundFailed:
      "The refund didn't go through. No money has moved, so you can try again.",
  },

  // ── Shared across pages ───────────────────────────────────────────────────

  common: {
    tryAgain: 'Try again',
    cancel: 'Cancel',
    back: 'Back',
    save: 'Save',
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
    signIn: 'Sign in',
    signOut: 'Sign out',
    account: 'Account',
    switchAccount: 'Switch demo account',
    /** What each demo account stands in for, shown wherever you pick one. */
    personaRole: {
      alex: { short: 'Buyer Flow', long: 'Buyer Flow' },
      mike: { short: 'Seller Flow', long: 'Seller Flow' },
      admin: { short: 'Admin', long: 'Admin: reviews payments, refunds, disputes' },
    },
    resetConfirm:
      'Reset the demo? This clears your cart, created listings and sign-in in this browser.',
    footer:
      'Slabbed is a demo. Listings, sellers and accounts are synthetic; payments run in the Hyperswitch sandbox.',
  },

  account: {
    title: 'Account',
    profile: 'Profile',
    name: 'Name',
    nameHint: 'Shown in the top bar and filled in as your ship-to name at checkout.',
    email: 'Email',
    signedInWith: (provider: string) => `Signed in with ${provider}`,
    saved: 'Saved',
    methods: 'Payment methods',
    methodsLoading: 'Loading saved cards…',
    methodsFailed: "We couldn't load your saved cards.",
    noCards:
      'No saved cards yet. Tick "Save card" when you pay, and the card shows up here.',
    card: (network: string | undefined, last4: string) =>
      `${network ?? 'Card'} ending in ${last4}`,
    expires: (expiry: string) => `Expires ${expiry}`,
    remove: 'Remove',
    addCard: 'Add a card',
    saveCard: 'Save card',
    addCardFact: 'Nothing is charged. Your card is checked and stored with Hyperswitch.',
    addCardFailed: "We couldn't start adding a card. Nothing was saved.",
    cardSaving: 'Saving your card…',
    cardNotSaved: "That card wasn't saved. Try again or use another card.",
    removeConfirm: (label: string) => `Remove ${label} from your account?`,
    removeFailed: "That card wasn't removed. Try again.",
    otherMethods:
      'Bank accounts aren’t saved yet. Cards are stored with Hyperswitch, never by Slabbed.',
    paypal: 'PayPal',
    paypalLinked: (email: string) => `Linked as ${email}`,
    paypalNone: 'Not linked',
    paypalLink: 'Link PayPal',
    paypalUnlink: 'Unlink',
    paypalDemo:
      'Demo link: nothing is sent to PayPal. At checkout, PayPal still signs in through Hyperswitch.',
    paypalTitle: 'Link PayPal (demo)',
    paypalChoose: 'Choose the PayPal account to link',
    paypalConsent:
      'Slabbed will see this PayPal email address. You can unlink it any time.',
    reset: 'Reset demo',
    resetFact:
      "Clears this browser's cart, created listings, sold markers, saved name, linked PayPal and sign-in. Real sandbox orders and saved cards are never touched.",
    demo: 'Demo account',
    demoFact: 'Switch to another demo person to see the marketplace from their side.',
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

  /** Shared labels for the catalogue listing card. */
  tile: {
    grade: 'Grade',
    cert: 'Cert',
    year: 'Year',
    viewDetails: 'View details',
    watch: 'Add to watch list',
    unwatch: 'Remove from watch list',
  },

  /** Page headers: a short eyebrow over one plain headline. */
  pageHeaders: {
    orders: { eyebrow: 'Your collection', title: 'Orders' },
    sell: { eyebrow: 'Seller', title: 'Your sales and listings' },
    admin: { eyebrow: 'Marketplace operations', title: 'Payments and disputes' },
    adminPayment: { eyebrow: 'Payment review' },
  },

  sold: {
    label: 'Sold',
    listing: 'This one-of-one item has sold.',
    cartLine: 'No longer available to buy.',
    groupAllSold: 'Everything from this seller has sold.',
  },

  catalogue: {
    watchlist: 'Watchlist',
    chips: {
      coin: 'Coins',
      card: 'Cards',
      graded: 'Graded',
      raw: 'Raw',
      free: 'Free shipping',
      watching: 'Watching',
    },
    filters: 'Filters',
    filterGroups: [
      { label: 'Category', chips: ['coin', 'card'] },
      { label: 'Grading', chips: ['graded', 'raw'] },
      { label: 'Shipping', chips: ['free'] },
    ],
    clearFilters: 'Clear',
    results: 'listings',
    of: 'of',
    allListings: 'All listings',
    pagination: 'Pages',
    page: 'Page',
    prev: 'Previous',
    next: 'Next',
  },

  listing: {
    raw: 'Raw',
    rawLong: 'Raw (ungraded)',
    notFoundTitle: 'Listing not found',
    notFound: "This listing isn't here",
    notFoundFact: 'The link may be wrong, or the listing was created in another browser.',
    back: 'Back to listings',
    cert: 'Cert',
    buyNow: 'Buy Now',
    addToCart: 'Add to Cart',
    viewInCart: 'View in Cart',
    own: 'This is your listing.',
    ownLink: 'See it on your seller page',
    adminCantBuy: "Admins can't buy. Switch to Alex or Mike to buy this.",
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
    remove: 'Remove',
    qty: 'Qty',
    items: 'Items',
    shipping: 'Shipping',
    subtotal: 'Subtotal',
    tax: 'Sales tax',
    total: 'Total',
    summary: 'Order summary',
    own: "Your listing — it isn't included at checkout.",
    admin: "Admins can't buy. Switch to Alex or Mike to check out.",
    checkOut: 'Proceed to Checkout',
    nothingToBuy: 'Nothing in your cart can be bought right now.',
  },

  checkoutPage: {
    title: 'Checkout',
    close: 'Close checkout',
    emptyGroup: 'Nothing in your cart to check out',
    backToCart: 'Back to cart',
    admin: 'Admins don’t check out',
    adminBody: 'Switch to Alex or Mike in the top bar to buy.',
    shipTo: 'Ship to',
    fields: { name: 'Name', line1: 'Address', city: 'City', state: 'State', zip: 'ZIP' },
    continue: 'Continue to Payment',
    starting: 'Starting…',
    payment: 'Payment',
    summary: 'Summary',
    items: 'Items',
    shipping: 'Shipping',
    tax: 'Tax',
    total: 'Total',
    startFailed: "Nothing has been charged. We couldn't start this payment — try again.",
  },

  order: {
    title: 'Order',
    number: 'Order number',
    placed: 'Placed',
    fromSeller: (handle: string) => `Shipped by ${handle}`,
    loading: 'Loading order…',
    backToOrders: 'Back to orders',
    backToSales: 'Back to sales',
    backToAdmin: 'Back to transactions',
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
    status: 'Status',
    updated: 'Updated',
    paidWith: 'Paid with',
    card: (network: string | undefined, last4: string) =>
      `${network ?? 'Card'} ending in ${last4}`,
    expires: (expiry: string) => `expires ${expiry}`,
    paypal: 'PayPal',
    refund: 'Refund',
  },

  orders: {
    title: 'Your orders',
    loadFailed: "We couldn't load your orders.",
    loadFailedFact: 'Your payments are unaffected. This only failed to read them.',
    loading: 'Loading orders',
    updating: 'Checking for updates…',
    gone: 'Listing no longer available',
    more: (n: number) => ` + ${n} more`,
    itemCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },

  sell: {
    title: 'Selling',
    adminOnly: 'Selling is for buyer and seller accounts',
    adminFact: 'Switch to Alex or Mike to list items and ship sales.',
    listings: 'Active listings',
    newListing: 'Create a listing',
    remove: 'Remove',
    removeTitle: 'Remove this listing?',
    removeBody: (title: string) =>
      `${title} comes off the shop straight away and can no longer be bought. Sales you have already made are not affected.`,
    removeConfirm: 'Remove listing',
    keepListing: 'Keep it',
    sales: 'Recently sold',
    loading: 'Loading sales',
    loadingListings: 'Loading listings',
    summary: 'Sales summary',
    toShipCard: 'Waiting on shipping',
    toShipNote: (n: number) =>
      n === 0
        ? 'Nothing to ship'
        : `Paid to you once ${n === 1 ? 'it ships' : `${n} sales ship`}`,
    recentCard: 'Sales, last 90 days',
    recentNote: (n: number) => `${n} ${n === 1 ? 'sale' : 'sales'}, before fees`,
    payoutCard: 'Pending payouts',
    payoutNote: (n: number) =>
      n === 0
        ? 'Ship a sale to start a payout'
        : `${n} shipped ${n === 1 ? 'sale' : 'sales'}, queued for payout`,
    requestsCard: 'Refund requests',
    requestsNote: (n: number) => (n === 0 ? 'None open' : `${n} waiting on you`),
    boughtBy: 'Bought by',
    loadFailed: "We couldn't load your sales.",
    loadFailedFact: 'Nothing has changed. Check your connection and try again.',
    pending: 'Awaiting shipment',
    available: 'Payout pending',
    reversed: 'Reversed',
    filterSales: 'Filter sales by status',
    saleFilters: {
      all: 'All',
      toShip: 'To ship',
      shipped: 'Shipped',
      received: 'Delivered',
      issue: 'Issue raised',
      refunded: 'Refunded',
    },
    filterListings: 'Filter listings by category',
    listingFilters: { all: 'All', coin: 'Coins', card: 'Cards' },
    searchListings: 'Search your listings',
    listedOn: 'Listed',
    noneInFilter: 'Nothing matches this filter.',
  },

  sellNew: {
    title: 'Create a listing',
    adminOnly: 'Listings are created by buyer and seller accounts',
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
      'The seller decides whether to refund. Their balance for this sale is held until then.',
    sellerRefunds: 'Refunds are issued by the seller from their sales.',
    disputeReason: 'Buyer’s reason',
    noDisputeReason: 'The buyer gave no reason.',
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
    pending: 'Awaiting shipment',
    available: 'Payout pending',
    reversed: 'Reversed',
  },
} as const
