import type { CSSProperties } from 'react'

interface UserAvatarProps {
  username: string
  avatar?: string | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
}

export function UserAvatar({ username, avatar, size = 'md', className }: UserAvatarProps) {
  const dimension = sizeMap[size]
  const initial = username.charAt(0).toUpperCase()

  const style: CSSProperties = {
    width: dimension,
    height: dimension,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px',
    fontWeight: 500,
    color: '#1F2421',
    background: avatar ? 'transparent' : '#F2E3D6',
    overflow: 'hidden',
  }

  return (
    <div style={style} className={className}>
      {avatar ? (
        <img src={avatar} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
