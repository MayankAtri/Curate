import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

function LoginPage() {
  const navigate = useNavigate();
  const currentEdition = `${new Date().getFullYear()}.1`;
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/feed');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleModeToggle = () => {
    setIsLogin((prev) => !prev);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await authService.login({
          email: formData.email,
          password: formData.password,
        });
      } else {
        await authService.register({
          email: formData.email,
          password: formData.password,
        });
      }
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-['Work_Sans'] antialiased min-h-screen bg-[#fdf9f4] text-[#1c1c19]">
      <main className="flex min-h-screen w-full overflow-hidden">
        <section className="hidden lg:flex flex-col w-[60%] bg-[#f4f0eb] p-12 relative overflow-hidden border-r-4 border-black">
          <div className="z-20 mb-auto">
            <h1 className="text-4xl font-['Newsreader'] italic font-extrabold tracking-tighter">CURATE</h1>
            <div className="mt-2 h-1 w-24 bg-[#b32100]"></div>
          </div>
          <div className="z-20 my-12">
            <h2 className="text-8xl font-['Newsreader'] font-bold leading-[0.9] tracking-tight max-w-2xl">
              START FRESH.
            </h2>
            <p className="font-['Space_Grotesk'] text-sm uppercase tracking-[0.2em] mt-8 text-[#5e3f38] max-w-md">
              Email in. Pick your topics. Let Curate handle the signal.
            </p>
          </div>
          <div className="z-10 mt-auto border-4 border-black aspect-[16/9] w-full overflow-hidden bg-white">
            <img
              alt="Curate intelligence stream"
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
              src="https://images.unsplash.com/photo-1611974714024-462cd9dc1a95?auto=format&fit=crop&q=80&w=1200"
            />
          </div>
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 rotate-90 hidden xl:block">
            <span className="font-['Space_Grotesk'] text-[120px] leading-none opacity-5 select-none font-bold uppercase">{`EDITION ${currentEdition}`}</span>
          </div>
        </section>

        <section className="w-full lg:w-[40%] bg-[#f4f0eb] p-8 lg:p-16 flex flex-col justify-center items-center relative">
          <div className="w-full max-w-md space-y-12">
            <div className="lg:hidden text-center mb-12">
              <h1 className="text-5xl font-['Newsreader'] italic font-extrabold tracking-tighter">CURATE</h1>
              <div className="mt-4 font-['Space_Grotesk'] text-xs uppercase tracking-widest text-[#b32100]">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </div>
            </div>

            <div className="border-4 border-black bg-[#fdf9f4] p-10 shadow-[8px_8px_0px_0px_#1c1c19]">
              <header className="mb-10 border-b-4 border-black pb-6">
                <h3 className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="text-[#b32100]">●</span>
                  {isLogin ? 'Log in to Curate' : 'Create a Curate account'}
                </h3>
              </header>

              {error && (
                <div className="bg-[#ffdad6] text-[#93000a] p-4 border-4 border-[#ba1a1a] mb-8 font-['Space_Grotesk'] text-xs font-bold uppercase">
                  {error}
                </div>
              )}

              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-widest text-[#5e3f38] block">
                    Email
                  </label>
                  <input
                    className="w-full border-4 border-black bg-white px-4 py-4 font-['Space_Grotesk'] text-sm focus:outline-none focus:bg-[#fdf9f4]"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-widest text-[#5e3f38] block">
                    Password
                  </label>
                  <input
                    className="w-full border-4 border-black bg-white px-4 py-4 font-['Space_Grotesk'] text-sm focus:outline-none focus:bg-[#fdf9f4]"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                  />
                </div>

                {!isLogin && (
                  <p className="font-['Space_Grotesk'] text-[11px] uppercase tracking-wider text-[#5e3f38]">
                    Your display name will be created automatically from your email. You can change it later.
                  </p>
                )}

                <div className="pt-4">
                  <button
                    className="w-full bg-[#ff3300] text-white font-['Space_Grotesk'] font-bold py-5 border-4 border-black uppercase tracking-widest text-sm hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all shadow-[4px_4px_0px_0px_#1c1c19] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-70 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Working...' : isLogin ? 'Log In' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>

            <div className="text-center space-y-4">
              <p className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.2em]">
                {isLogin ? 'Need an account?' : 'Already have an account?'}
                <button
                  onClick={handleModeToggle}
                  className="text-[#b32100] hover:underline underline-offset-4 ml-2"
                >
                  {isLogin ? 'Create one' : 'Log in instead'}
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LoginPage;
