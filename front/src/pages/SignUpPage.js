import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/login', { 
        email: email.trim(), 
        password: password.trim() 
      });
      
      if (response.data.success) {
        // 로컬 스토리지에 사용자 정보 저장
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // 메인 페이지로 이동
        navigate('/main');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      if (error.response && error.response.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (error.response && error.response.status === 404) {
        setError('존재하지 않는 사용자입니다.');
      } else {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '40px',
        paddingTop: '20px'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '15px',
            color: '#333'
          }}
        >
          ←
        </button>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          margin: 0,
          color: '#333'
        }}>
          로그인
        </h1>
      </div>

      {/* 로그인 폼 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '400px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px 30px',
          borderRadius: '15px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            textAlign: 'center',
            marginBottom: '30px',
            color: '#333',
            fontSize: '20px'
          }}>
            계정으로 로그인
          </h2>

          <form onSubmit={handleLogin}>
            {/* 이메일 입력 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#555',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D2B48C'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
            </div>

            {/* 비밀번호 입력 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#555',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D2B48C'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div style={{
                backgroundColor: '#ffebee',
                color: '#c62828',
                padding: '12px 15px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                border: '1px solid #ffcdd2'
              }}>
                {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                backgroundColor: loading ? '#ccc' : '#D2B48C',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.target.style.backgroundColor = '#C19A6B';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.target.style.backgroundColor = '#D2B48C';
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 안내 메시지 */}
          <div style={{
            marginTop: '30px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.5'
          }}>
            <strong>체험용 계정:</strong><br/>
            • admin@example.com / admin123<br/>
            • guest@example.com / guest123<br/>
            • test@example.com / test123<br/>
            • user1@example.com / password1<br/>
            • user2@example.com / password2
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
