import { useEffect, type ComponentType } from 'react'
import { navigate, type Params } from './lib/navigation.ts'
import { Router, type Route } from './lib/router.tsx'
import { useSession } from './lib/session.ts'
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
import SignIn from './pages/SignIn.tsx'
import SignInProvider from './pages/SignInProvider.tsx'

type Page = ComponentType<{ params: Params }>

/** The one sign-in guard: signed out, go to /signin and come back here afterwards. */
function signedIn(Page: Page): Page {
  return function Guarded(props) {
    const session = useSession()
    // Read at render: StrictMode re-runs the effect after the first redirect already changed the URL.
    const next = encodeURIComponent(location.pathname + location.search)
    useEffect(() => {
      if (!session) navigate(`/signin?next=${next}`, { replace: true })
    }, [session, next])
    return session ? <Page {...props} /> : null
  }
}

// Pages receive { params }; stubs may ignore it.
const routes: Route[] = [
  { path: '/', component: Catalogue },
  { path: '/listing/:id', component: Listing },
  { path: '/cart', component: Cart },
  { path: '/signin', component: SignIn },
  { path: '/signin/:provider', component: SignInProvider },
  { path: '/checkout', component: signedIn(Checkout) },
  // A bare payment id shows every seller's order in that purchase; <paymentId>.<sellerId> shows one.
  { path: '/order/:paymentId', component: signedIn(Order) },
  { path: '/orders', component: signedIn(Orders) },
  { path: '/sell', component: signedIn(Sell) },
  { path: '/sell/new', component: signedIn(SellNew) },
  { path: '/admin', component: signedIn(Admin) },
  { path: '/admin/payment/:id', component: signedIn(AdminPayment) },
]

function NotFound() {
  return <h1>Not found</h1>
}

export default function App() {
  return <Router routes={routes} notFound={NotFound} />
}
