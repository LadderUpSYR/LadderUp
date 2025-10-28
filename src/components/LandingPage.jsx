import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../utils/useDarkMode';

const LandingPage = ({ onSignIn, onSignUp }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState({});
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1
    });

    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full opacity-20 animate-float ${
              isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>
      
      {/* Mouse follower glow */}
      <div
        className={`fixed w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-300 ease-out ${
          isDarkMode ? 'bg-sky-blue/10' : 'bg-sky-500/10'
        }`}
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />
      {/* Navigation */}
      <nav className={`shadow-lg border-b transition-colors duration-500 ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className={`text-2xl font-bold transition-colors duration-500 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
              }`}>LadderUp</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isDarkMode 
                    ? 'bg-sky-blue focus:ring-sky-blue' 
                    : 'bg-gray-300 focus:ring-sky-600'
                }`}
                aria-label="Toggle theme"
              >
                <span
                  className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                    isDarkMode 
                      ? 'translate-x-9 bg-gray-900' 
                      : 'translate-x-1 bg-white'
                  }`}
                >
                  <span className="flex items-center justify-center h-full">
                    {isDarkMode ? (
                      <svg className="w-4 h-4 text-sky-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </span>
              </button>
              <button
                onClick={onSignIn}
                className={`px-6 py-2 transition-colors duration-200 ${
                  isDarkMode 
                    ? 'text-gray-300 hover:text-sky-blue' 
                    : 'text-gray-700 hover:text-sky-600'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={onSignUp}
                className={`px-6 py-2 font-semibold rounded-lg transition-all duration-200 shadow-lg ${
                  isDarkMode
                    ? 'bg-sky-blue text-black hover:bg-sky-400 shadow-sky-blue/50'
                    : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30'
                }`}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 overflow-hidden">
        {/* Animated gradient background */}
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDarkMode 
            ? 'bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800' 
            : 'bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200'
        }`}></div>
        
        {/* Animated gradient orbs */}
        <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          isDarkMode ? 'bg-sky-blue/20' : 'bg-sky-500/30'
        }`}></div>
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          isDarkMode ? 'bg-blue-500/20' : 'bg-blue-400/30'
        }`} style={{ animationDelay: '1s' }}></div>
        <div className={`absolute top-1/2 left-1/2 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          isDarkMode ? 'bg-purple-500/10' : 'bg-purple-400/20'
        }`} style={{ animationDelay: '2s' }}></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <div className={`inline-block mb-4 px-4 py-2 border rounded-full backdrop-blur-sm animate-bounce-slow transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-sky-blue/10 border-sky-blue/30' 
                : 'bg-sky-100 border-sky-600/30'
            }`}>
              <span className={`text-sm font-semibold transition-colors duration-500 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-700'
              }`}>🚀 AI-Powered Interview Mastery</span>
            </div>
            <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in-up transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Master Your Interviews with
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-blue via-blue-400 to-purple-400 animate-gradient bg-300%"> AI-Powered Preparation</span>
            </h1>
            <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in-up transition-colors duration-500 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`} style={{ animationDelay: '0.2s' }}>
              Get real-time AI feedback on your interview responses. Practice smarter, 
              perform better, and land your dream job.
            </p>
            
            {/* Stats Counter */}
            <div className="flex flex-wrap justify-center gap-8 mb-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="text-center">
                <div className={`text-4xl font-bold mb-1 transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>10K+</div>
                <div className={`text-sm transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Practice Sessions</div>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold mb-1 transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>95%</div>
                <div className={`text-sm transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Success Rate</div>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold mb-1 transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>500+</div>
                <div className={`text-sm transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Happy Users</div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <button
                onClick={onSignUp}
                className={`group px-8 py-4 bg-gradient-to-r from-sky-blue to-blue-400 text-lg font-semibold rounded-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 relative overflow-hidden ${
                  isDarkMode 
                    ? 'text-black hover:shadow-sky-blue/50' 
                    : 'text-white hover:shadow-sky-600/40'
                }`}
              >
                <span className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                <span className="flex items-center justify-center gap-2 relative z-10">
                  Start Practicing Free
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
              <button
                onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth' })}
                className={`group px-8 py-4 bg-transparent text-lg font-semibold rounded-lg border-2 transition-all duration-300 relative overflow-hidden ${
                  isDarkMode 
                    ? 'text-white hover:bg-gray-800 border-gray-700 hover:border-sky-blue' 
                    : 'text-gray-900 hover:bg-gray-100 border-gray-400 hover:border-sky-600'
                }`}
              >
                <span className={`absolute inset-0 bg-gradient-to-r transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left ${
                  isDarkMode ? 'from-sky-blue/10 to-blue-500/10' : 'from-sky-500/10 to-blue-400/10'
                }`}></span>
                <span className="relative z-10">Learn More</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 relative transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`} id="features" data-animate>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              AI-Powered Features
            </h2>
            <p className={`text-lg max-w-2xl mx-auto transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>Built with cutting-edge technology to elevate your interview game</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className={`group p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border hover:-translate-y-2 transform-gpu ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-sky-blue/50 hover:shadow-sky-blue/20' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-sky-600/50 hover:shadow-sky-600/20'
            }`}>
              <div className="w-16 h-16 bg-gradient-to-br from-sky-blue to-blue-500 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-blue/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className={`text-2xl font-bold mb-4 text-center transition-colors duration-500 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Intelligent Feedback</h3>
              <p className={`text-center leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Advanced AI analyzes your responses in real-time, providing detailed, 
                actionable insights to help you improve with every practice session.
              </p>
              <div className={`mt-6 pt-6 border-t transition-colors duration-500 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className={`flex items-center justify-center gap-2 text-sm font-semibold transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                  }`}></span>
                  Real-time Analysis
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className={`group p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border hover:-translate-y-2 transform-gpu ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-sky-blue/50 hover:shadow-sky-blue/20' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-sky-600/50 hover:shadow-sky-600/20'
            }`} style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-sky-blue to-blue-500 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-blue/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className={`text-2xl font-bold mb-4 text-center transition-colors duration-500 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Adaptive Questions</h3>
              <p className={`text-center leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Machine learning algorithms tailor interview questions to your 
                industry, experience level, and target role for maximum relevance.
              </p>
              <div className={`mt-6 pt-6 border-t transition-colors duration-500 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className={`flex items-center justify-center gap-2 text-sm font-semibold transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                  }`}></span>
                  Personalized Content
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className={`group p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border hover:-translate-y-2 transform-gpu ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-sky-blue/50 hover:shadow-sky-blue/20' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-sky-600/50 hover:shadow-sky-600/20'
            }`} style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-sky-blue to-blue-500 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-blue/30">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className={`text-2xl font-bold mb-4 text-center transition-colors duration-500 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Performance Analytics</h3>
              <p className={`text-center leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Data-driven insights track your progress over time, highlighting 
                strengths and identifying areas for improvement.
              </p>
              <div className={`mt-6 pt-6 border-t transition-colors duration-500 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className={`flex items-center justify-center gap-2 text-sm font-semibold transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                  }`}></span>
                  Track Progress
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={`py-20 relative transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
      }`} data-animate>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className={`text-4xl md:text-5xl font-bold mb-6 transition-colors duration-500 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                The Future of Interview Prep
              </h2>
              <p className={`text-lg leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                LadderUp leverages cutting-edge AI technology to revolutionize how you 
                prepare for interviews. Our platform uses advanced natural language 
                processing to understand your responses and provide personalized feedback.
              </p>
              <p className={`text-lg leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Whether you're breaking into a field, climbing the corporate ladder, or 
                pivoting careers, our AI adapts to your unique journey and provides 
                targeted guidance.
              </p>
              <p className={`text-lg leading-relaxed transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Transform your interview performance with AI-powered preparation that 
                helps you practice smarter and perform better when it matters most.
              </p>
              
              {/* Trust indicators */}
              <div className="grid grid-cols-2 gap-4 pt-6">
                <div className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm transition-colors duration-500 ${
                  isDarkMode 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-white/80 border-gray-300'
                }`}>
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className={`font-semibold transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Secure & Private</div>
                    <div className={`text-sm transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Your data is safe</div>
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm transition-colors duration-500 ${
                  isDarkMode 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-white/80 border-gray-300'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${
                    isDarkMode ? 'bg-sky-blue/20' : 'bg-sky-500/20'
                  }`}>
                    <svg className={`w-5 h-5 transition-colors duration-500 ${
                      isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div>
                    <div className={`font-semibold transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Top Rated</div>
                    <div className={`text-sm transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>4.9/5 stars</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`p-8 rounded-xl shadow-2xl border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-black border-gray-700 hover:border-sky-blue/50 hover:shadow-sky-blue/10' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-300 hover:border-sky-600/50 hover:shadow-sky-600/10'
            }`}>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-sky-blue to-blue-400 bg-clip-text text-transparent mb-6">How It Works</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4 group">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-blue to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm mt-1 shadow-lg shadow-sky-blue/30 group-hover:scale-110 transition-transform duration-300">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 text-left transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Sign Up & Set Your Goals</h4>
                    <p className={`text-left leading-relaxed transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Create your account and tell us about your career aspirations.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-blue to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm mt-1 shadow-lg shadow-sky-blue/30 group-hover:scale-110 transition-transform duration-300">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 text-left transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Practice with AI</h4>
                    <p className={`text-left leading-relaxed transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Answer questions tailored to your industry and get instant AI analysis.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-blue to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm mt-1 shadow-lg shadow-sky-blue/30 group-hover:scale-110 transition-transform duration-300">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 text-left transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Improve & Iterate</h4>
                    <p className={`text-left leading-relaxed transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Review detailed feedback and track your progress over time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-blue to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm mt-1 shadow-lg shadow-sky-blue/30 group-hover:scale-110 transition-transform duration-300">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 text-left transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Ace Your Interview</h4>
                    <p className={`text-left leading-relaxed transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Walk in confident with refined answers and proven techniques.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className={`py-20 relative overflow-hidden transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`} data-animate>
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDarkMode ? 'bg-gradient-to-r from-sky-blue/5 to-purple-500/5' : 'bg-gradient-to-r from-sky-500/5 to-purple-400/5'
        }`}></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Success Stories
            </h2>
            <p className={`text-lg transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>See how LadderUp helped others land their dream jobs</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Chen",
                role: "Software Engineer at Google",
                quote: "LadderUp's AI feedback was incredibly detailed. I felt fully prepared walking into my interviews!",
                rating: 5
              },
              {
                name: "Marcus Johnson",
                role: "Product Manager at Meta",
                quote: "The personalized questions helped me practice scenarios I actually faced. Game changer!",
                rating: 5
              },
              {
                name: "Emily Rodriguez",
                role: "Data Scientist at Amazon",
                quote: "I went from nervous to confident in just two weeks of practice. Highly recommend!",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className={`group p-6 rounded-xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-sky-blue/50 hover:shadow-sky-blue/10' 
                  : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-sky-600/50 hover:shadow-sky-600/10'
              }`}>
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className={`mb-6 leading-relaxed italic transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-sky-blue to-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className={`font-semibold transition-colors duration-500 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>{testimonial.name}</div>
                    <div className={`text-sm transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 border-y relative overflow-hidden transition-colors duration-500 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-black via-gray-900 to-black border-gray-800' 
          : 'bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 border-gray-300'
      }`}>
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDarkMode ? 'bg-gradient-to-r from-sky-blue/10 to-purple-500/10' : 'bg-gradient-to-r from-sky-500/10 to-purple-400/10'
        }`}></div>
        {/* Animated circles */}
        <div className={`absolute top-10 left-10 w-32 h-32 rounded-full blur-2xl animate-pulse transition-colors duration-500 ${
          isDarkMode ? 'bg-sky-blue/20' : 'bg-sky-500/30'
        }`}></div>
        <div className={`absolute bottom-10 right-10 w-32 h-32 rounded-full blur-2xl animate-pulse transition-colors duration-500 ${
          isDarkMode ? 'bg-blue-500/20' : 'bg-blue-400/30'
        }`} style={{ animationDelay: '1s' }}></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className={`inline-block mb-6 px-4 py-2 border rounded-full backdrop-blur-sm transition-colors duration-500 ${
            isDarkMode 
              ? 'bg-sky-blue/10 border-sky-blue/30' 
              : 'bg-sky-100 border-sky-600/30'
          }`}>
            <span className={`text-sm font-semibold transition-colors duration-500 ${
              isDarkMode ? 'text-sky-blue' : 'text-sky-700'
            }`}>✨ Limited Time Offer</span>
          </div>
          <h2 className={`text-4xl md:text-5xl font-bold mb-6 transition-colors duration-500 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Ready to Transform Your Interview Game?
          </h2>
          <p className={`text-xl mb-8 transition-colors duration-500 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Join thousands of successful job seekers. Start practicing with AI today.
          </p>
          <button
            onClick={onSignUp}
            className={`group px-10 py-4 bg-gradient-to-r from-sky-blue to-blue-400 text-lg font-semibold rounded-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 relative overflow-hidden ${
              isDarkMode 
                ? 'text-black hover:shadow-sky-blue/50' 
                : 'text-white hover:shadow-sky-600/40'
            }`}
          >
            <span className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
            <span className="flex items-center justify-center gap-2 relative z-10">
              Get Started for Free
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
          <p className={`mt-4 text-sm transition-colors duration-500 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-600'
          }`}>No credit card required • Free forever plan available • 5-minute setup</p>
          
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-12 items-center">
            <div className={`flex items-center gap-2 transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">SSL Secured</span>
            </div>
            <div className={`flex items-center gap-2 transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <svg className={`w-5 h-5 transition-colors duration-500 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
              }`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">GDPR Compliant</span>
            </div>
            <div className={`flex items-center gap-2 transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm">4.9/5 Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t transition-colors duration-500 ${
        isDarkMode ? 'bg-black text-gray-500 border-gray-800' : 'bg-gray-100 text-gray-600 border-gray-300'
      }`}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">
            © 2025 LadderUp. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
