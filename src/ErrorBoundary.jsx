import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('VertiBalance 页面渲染失败', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error-card">
          <span className="fatal-error-code">页面加载异常</span>
          <h1>抱歉，页面暂时无法显示</h1>
          <p>请刷新页面重试。如果问题持续存在，请将浏览器控制台中的错误信息提供给技术人员。</p>
          <button type="button" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      </main>
    );
  }
}
