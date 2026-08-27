import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { UserAvatar } from '../../components/auth/UserAvatar'
import { authService } from '../../services/auth'
import type { User } from '../../types/auth'

export function UserListPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    const fetchUsers = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await authService.getUserList(page, pageSize)
        setUsers(response.users)
        setTotal(response.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUsers()
  }, [page, pageSize, isAuthenticated, navigate])

  const filteredUsers = users.filter((user: User) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F4EF',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          padding: '24px 0',
          borderBottom: '1px solid #E7E1D7',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 400,
            fontFamily: 'Fraunces, serif',
            color: '#1F2421',
            letterSpacing: '-0.02em',
          }}>
            User <span style={{ fontStyle: 'italic', color: '#C4612F' }}>Directory</span>
          </h1>

          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 400,
              color: '#1F2421',
              background: '#FFFFFF',
              border: '1px solid #E7E1D7',
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FBF9F5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF'
            }}
          >
            Back to profile
          </button>
        </header>

        <div style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              minWidth: '250px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 300,
              border: '1px solid #E7E1D7',
              borderRadius: '999px',
              background: '#FFFFFF',
              color: '#1F2421',
              outline: 'none',
            }}
          />

          <div style={{
            fontSize: '13px',
            fontWeight: 300,
            color: '#5C635D',
            padding: '8px 16px',
            background: '#FFFFFF',
            border: '1px solid #E7E1D7',
            borderRadius: '999px',
          }}>
            {total} total users
          </div>
        </div>

        {error && (
          <div style={{
            padding: '16px',
            background: '#F2E3D6',
            border: '1px solid #C4612F',
            borderRadius: '12px',
            fontSize: '14px',
            color: '#1F2421',
            fontWeight: 300,
            marginBottom: '24px',
          }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{
            textAlign: 'center',
            padding: '64px',
            fontSize: '14px',
            fontWeight: 300,
            color: '#5C635D',
          }}>
            Loading users...
          </div>
        ) : (
          <>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E7E1D7',
              overflow: 'hidden',
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{
                    background: '#FBF9F5',
                    borderBottom: '1px solid #E7E1D7',
                  }}>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#5C635D',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      User
                    </th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#5C635D',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Email
                    </th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#5C635D',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      User ID
                    </th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#5C635D',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.userId}
                      style={{
                        borderBottom: '1px solid #E7E1D7',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#FBF9F5'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <td style={{
                        padding: '16px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}>
                          <UserAvatar username={user.username} avatar={user.avatar} size="sm" />
                          <span style={{
                            fontSize: '14px',
                            fontWeight: 400,
                            color: '#1F2421',
                          }}>
                            {user.username}
                          </span>
                        </div>
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        fontWeight: 300,
                        color: '#5C635D',
                      }}>
                        {user.email}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '13px',
                        fontWeight: 300,
                        color: '#5C635D',
                        fontFamily: 'monospace',
                      }}>
                        {user.userId.slice(0, 8)}...
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '13px',
                        fontWeight: 300,
                        color: '#5C635D',
                      }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  fontSize: '14px',
                  fontWeight: 300,
                  color: '#5C635D',
                }}>
                  No users found
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                marginTop: '24px',
              }}>
                <button
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: page === 1 ? '#5C635D' : '#1F2421',
                    background: '#FFFFFF',
                    border: '1px solid #E7E1D7',
                    borderRadius: '8px',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Previous
                </button>

                <span style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  color: '#1F2421',
                }}>
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: page === totalPages ? '#5C635D' : '#1F2421',
                    background: '#FFFFFF',
                    border: '1px solid #E7E1D7',
                    borderRadius: '8px',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
