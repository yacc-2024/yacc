import { useEffect, useRef } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom'
import { useApp } from './state/AppContext'
import { TabBar, PageSkeleton, Sheet } from './components/ui'
import { RequireAdmin } from './components/guards'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { NewsList, EventsList } from './pages/News'
import { Members } from './pages/Members'
import { MemberDetail } from './pages/MemberDetail'
import { Works } from './pages/Works'
import { Watch } from './pages/Watch'
import { UserProfile } from './pages/UserProfile'
import { Me } from './pages/Me'
import { Login } from './pages/Login'
import { Favorites, History } from './pages/Library'
import {
  Settings,
  ProfileSettings,
  PasswordSettings,
  AppearanceSettings,
  Version,
} from './pages/Account'
import { AdminIndex } from './pages/admin/Index'
import { HomeEdit, AboutEdit } from './pages/admin/ContentEdit'
import { MembersAdmin } from './pages/admin/MembersAdmin'
import { WorksAdmin } from './pages/admin/WorksAdmin'
import { DataAdmin } from './pages/admin/DataAdmin'
import { AccountsAdmin, CommentsAdmin } from './pages/admin/Online'
import { ChangelogAdmin } from './pages/admin/Changelog'

/** 记住每个历史记录项的滚动位置，返回时还原 */
function ScrollMemory() {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef<Record<string, number>>({})

  useEffect(() => {
    if (navType === 'POP') {
      const y = positions.current[location.key] ?? 0
      window.scrollTo(0, y)
    } else {
      window.scrollTo(0, 0)
    }
    const key = location.key
    return () => {
      positions.current[key] = window.scrollY
    }
  }, [location.key, navType])

  return null
}

function TabLayout() {
  const location = useLocation()
  return (
    <div className="app">
      <ScrollMemory />
      <div className="page">
        <div className="container">
          <div className="route-enter" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
      <TabBar />
    </div>
  )
}

function PlainLayout() {
  const location = useLocation()
  return (
    <div className="app">
      <ScrollMemory />
      <div className="page page--no-tabs">
        <div className="container">
          <div className="route-enter" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="app">
      <div className="page page--no-tabs">
        <div className="page__body" style={{ paddingTop: 80, textAlign: 'center' }}>
          <p className="t-title3">内容加载失败</p>
          <p className="t-caption" style={{ marginTop: 8 }}>
            {message}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 24 }}
            onClick={onRetry}
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const { content, loading, error, reload, kicked, dismissKicked } = useApp()
  const navigate = useNavigate()

  if (loading && !content) {
    return (
      <div className="app">
        <div className="page">
          <div className="container">
            <PageSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!content) {
    return <ErrorScreen message={error ?? '未知错误'} onRetry={() => void reload()} />
  }

  return (
    <>
      <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<Home />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="works" element={<Works />} />
        <Route path="me" element={<Me />} />
      </Route>

      <Route element={<PlainLayout />}>
        <Route path="about" element={<About />} />
        <Route path="news" element={<NewsList />} />
        <Route path="events" element={<EventsList />} />
        <Route path="watch/:id" element={<Watch />} />
        <Route path="login" element={<Login />} />
        <Route path="u/:uid" element={<UserProfile />} />
        <Route path="me/favorites" element={<Favorites />} />
        <Route path="me/history" element={<History />} />
        <Route path="me/settings" element={<Settings />} />
        <Route path="me/settings/profile" element={<ProfileSettings />} />
        <Route path="me/settings/password" element={<PasswordSettings />} />
        <Route path="me/settings/appearance" element={<AppearanceSettings />} />
        <Route path="me/version" element={<Version />} />

        <Route path="admin" element={<RequireAdmin><AdminIndex /></RequireAdmin>} />
        <Route path="admin/home" element={<RequireAdmin><HomeEdit /></RequireAdmin>} />
        <Route path="admin/about" element={<RequireAdmin><AboutEdit /></RequireAdmin>} />
        <Route
          path="admin/members"
          element={<RequireAdmin><MembersAdmin /></RequireAdmin>}
        />
        <Route path="admin/works" element={<RequireAdmin><WorksAdmin /></RequireAdmin>} />
        <Route path="admin/data" element={<RequireAdmin><DataAdmin /></RequireAdmin>} />
        <Route
          path="admin/changelog"
          element={<RequireAdmin><ChangelogAdmin /></RequireAdmin>}
        />
        <Route
          path="admin/accounts"
          element={<RequireAdmin><AccountsAdmin /></RequireAdmin>}
        />
        <Route path="admin/keys" element={<RequireAdmin><AccountsAdmin /></RequireAdmin>} />
        <Route
          path="admin/comments"
          element={<RequireAdmin><CommentsAdmin /></RequireAdmin>}
        />


        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>

      <Sheet
        open={kicked}
        title="账号已在别处登录"
        onClose={dismissKicked}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={dismissKicked}>
              知道了
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                dismissKicked()
                navigate('/login')
              }}
            >
              重新登录
            </button>
          </>
        }
      >
        <p className="t-body muted">
          同一个账号只能在一台设备上使用。如果不是你本人操作，建议尽快修改密码。
        </p>
      </Sheet>
    </>
  )
}
