import type { User } from '../../types/auth'
import { UserAvatar } from './UserAvatar'

interface UserProfileProps {
  user: User
}

export function UserProfile({ user }: UserProfileProps) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      padding: '32px',
      border: '1px solid #E7E1D7',
      maxWidth: '600px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
        <UserAvatar username={user.username} avatar={user.avatar} size="lg" />
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 400,
            fontFamily: 'Fraunces, serif',
            color: '#1F2421',
          }}>
            {user.username}
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: '14px',
            color: '#5C635D',
            fontWeight: 300,
          }}>
            {user.email}
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gap: '16px',
        fontSize: '14px',
        fontWeight: 300,
      }}>
        <div style={{
          display: 'flex',
          padding: '16px',
          background: '#FBF9F5',
          borderRadius: '8px',
        }}>
          <span style={{ color: '#5C635D', minWidth: '120px' }}>User ID</span>
          <span style={{ color: '#1F2421', fontFamily: 'monospace' }}>{user.userId}</span>
        </div>

        <div style={{
          display: 'flex',
          padding: '16px',
          background: '#FBF9F5',
          borderRadius: '8px',
        }}>
          <span style={{ color: '#5C635D', minWidth: '120px' }}>Created At</span>
          <span style={{ color: '#1F2421' }}>
            {new Date(user.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
