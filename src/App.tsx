import { Router, type Route } from './lib/router.tsx'
import Admin from './pages/Admin.tsx'
import AdminPayment from './pages/AdminPayment.tsx'
import Cart from './pages/Cart.tsx'
import Catalogue from './pages/Catalogue.tsx'
import Checkout from './pages/Checkout.tsx'
import Listing from './pages/Listing.tsx'
import Order from './pages/Order.tsx'
import Orders from './pages/Orders.tsx'
import Sell from './pages/Sell.tsx'
import SellNew from './pages/SellNew.tsx'

// Pages receive { params }; stubs may ignore it.
const routes: Route[] = [
  { path: '/', component: Catalogue },
  { path: '/listing/:id', component: Listing },
  { path: '/cart', component: Cart },
  { path: '/checkout/:sellerId', component: Checkout },
  { path: '/order/:paymentId', component: Order },
  { path: '/orders', component: Orders },
  { path: '/sell', component: Sell },
  { path: '/sell/new', component: SellNew },
  { path: '/admin', component: Admin },
  { path: '/admin/payment/:id', component: AdminPayment },
]

function NotFound() {
  return <h1>Not found</h1>
}

export default function App() {
  return <Router routes={routes} notFound={NotFound} />
}
