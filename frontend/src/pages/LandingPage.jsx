import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService, feedService } from '../services/api';
import { useTopics } from '../hooks/useTopics';

function getArticleImage(article) {
    if (article?.imageUrl) return article.imageUrl;
    const seed = article?.title ? article.title.slice(0, 18).replace(/\s/g, '') : 'curate-landing';
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/800`;
}

function LandingPage() {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();
    const { topics } = useTopics();
    const [trendingItems, setTrendingItems] = useState([]);

    useEffect(() => {
        if (authService.isAuthenticated()) {
            navigate('/feed');
        }
    }, [navigate]);

    useEffect(() => {
        let cancelled = false;

        feedService.getTrending(6)
            .then((data) => {
                if (!cancelled) {
                    setTrendingItems(data.items || []);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, []);

    const primaryStory = trendingItems[0]?.article || null;
    const secondaryStory = trendingItems[1]?.article || null;
    const tertiaryStory = trendingItems[2]?.article || null;
    const dispatchCount = trendingItems.length;
    const topicCount = topics.length;
    const navTopics = topics.slice(0, 4);
    const sourceCount = useMemo(
        () => new Set(trendingItems.map((item) => item.article?.source?.name).filter(Boolean)).size,
        [trendingItems]
    );

    return (
        <div className="antialiased overflow-x-hidden bg-[#fdf9f4] text-[#1c1c19] min-h-screen font-['Public_Sans']">
            {/* STITCH V2 NAVIGATION */}
            <nav className="flex justify-between items-center w-full px-6 py-4 bg-[#fdf9f4] border-b-4 border-black sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <span className="text-4xl font-black font-serif italic text-black tracking-tighter">CURATE</span>
                    <div className="hidden lg:flex gap-6 items-center">
                        {navTopics.map((topic) => (
                            <Link
                                key={topic.id}
                                className="text-black font-bold hover:text-[#FF3300] font-['Space_Grotesk'] uppercase text-sm"
                                to="/feed"
                            >
                                {topic.name}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/login" className="text-black font-bold hover:text-[#FF3300] font-['Space_Grotesk'] uppercase text-sm mr-4">Log In</Link>
                    <Link to="/onboarding" className="bg-[#b32100] text-white border-4 border-black px-6 py-2 font-['Space_Grotesk'] uppercase font-bold text-sm hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all duration-100 shadow-[4px_4px_0px_0px_#1c1c19]">
                        Get Started
                    </Link>
                </div>
            </nav>

            <main className="max-w-[1440px] mx-auto border-x-4 border-black bg-[#fdf9f4] min-h-screen">
                {/* SECTION 1: HERO */}
                <section className="border-b-4 border-black px-6 py-24 flex flex-col items-center text-center">
                    <div className="w-full mb-12">
                        <span className="font-['Space_Grotesk'] uppercase font-bold tracking-widest text-[#FF3300] block mb-4">{`Edition 001 // Live Briefing ${currentYear}`}</span>
                        <h1 className="font-['Fraunces'] text-[10vw] leading-[0.85] font-black italic tracking-tighter uppercase mb-12 border-y-4 border-black py-8 w-full">
                            THE NEWS, DISTILLED.
                        </h1>
                    </div>
                    <div className="grid grid-cols-12 w-full text-left gap-8">
                        <div className="col-span-12 lg:col-span-7">
                            <p className="font-['Newsreader'] text-4xl leading-tight font-medium">
                                Our proprietary selection logic bypasses the noise of the attention economy. We curate the essential, ignoring the ephemeral. High-density intelligence for the decisive reader.
                            </p>
                        </div>
                        <div className="col-span-12 lg:col-span-5 flex flex-col justify-end items-end">
                            <div className="bg-black text-white p-6 shadow-[8px_8px_0px_0px_#1c1c19] w-full max-w-sm border-4 border-black">
                                <p className="font-['Space_Grotesk'] uppercase text-xs mb-4 text-[#FF3300]">Now reading</p>
                                <p className="text-sm font-light leading-relaxed">
                                    {primaryStory
                                        ? `${primaryStory.source?.name || 'Live source'} now leads the briefing with "${primaryStory.title}".`
                                        : 'Live dispatches are being assembled into a concise intelligence brief.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 2: MANIFESTO */}
                <section className="grid grid-cols-1 lg:grid-cols-3 border-b-4 border-black">
                    <div className="p-12 lg:border-r-4 border-black flex flex-col">
                        <span className="font-['Space_Grotesk'] uppercase font-bold text-[#FF3300] mb-6 text-sm">01 / How Curate works</span>
                        <h2 className="font-['Fraunces'] text-5xl font-black uppercase mb-8 italic">THE LOGIC OF SELECTION.</h2>
                        <p className="font-['Newsreader'] text-xl leading-relaxed mb-6">
                            Unlike human editors, our system doesn't tire. It doesn't have biases based on yesterday's dinner. It looks at the semantic weight of information across 12 languages and 400 jurisdictions simultaneously.
                        </p>
                        <p className="font-['Newsreader'] text-xl leading-relaxed">
                            Selection is not about what is new; it is about what is consequential. We track the threads of power, capital, and cultural shift.
                        </p>
                    </div>
                    <div className="p-12 lg:border-r-4 border-black flex flex-col bg-[#f1ede8]">
                        <span className="font-['Space_Grotesk'] uppercase font-bold text-[#FF3300] mb-6 text-sm">02 / Why it matters</span>
                        <div className="mb-8 border-4 border-black p-1 bg-white">
                            <img className="w-full grayscale contrast-150" src={getArticleImage(primaryStory)} alt={primaryStory?.title || 'Live dispatch'} />
                        </div>
                        <p className="font-['Newsreader'] text-xl leading-relaxed">
                            {secondaryStory?.title || 'The Curate engine prioritizes structural changes over reactionary headlines.'}
                        </p>
                    </div>
                    <div className="p-12 flex flex-col bg-[#b32100] text-white">
                        <span className="font-['Space_Grotesk'] uppercase font-bold text-white mb-6 text-sm">03 / Editorial judgment</span>
                        <p className="font-['Newsreader'] text-xl leading-relaxed mb-6 italic font-bold">
                            "Intelligence is not the gathering of facts, but the recognition of patterns in a chaotic field."
                        </p>
                        <div className="mt-auto pt-12">
                            <p className="text-sm font-bold uppercase tracking-widest border-t-2 border-white pt-4">Final review by the editorial team</p>
                        </div>
                    </div>
                </section>

                {/* SECTION 3: SYSTEM SCALE */}
                <section className="bg-black text-white py-6 overflow-hidden border-b-4 border-black relative">
                    <div className="flex whitespace-nowrap gap-12">
                        <div className="flex items-center gap-12 text-6xl font-['Fraunces'] font-black uppercase italic tracking-tighter">
                            <span>{dispatchCount > 0 ? `${dispatchCount} Live stories loaded` : 'Live stories available'}</span>
                            <span className="text-[#FF3300]">●</span>
                            <span>{topicCount} Topics available</span>
                            <span className="text-[#FF3300]">●</span>
                            <span>{sourceCount > 0 ? `${sourceCount} Active sources` : 'Global coverage available'}</span>
                        </div>
                    </div>
                </section>

                {/* SECTION 4: BENTO GRID */}
                <section className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 min-h-[600px]">
                        <div className="md:col-span-3 border-4 border-black relative group overflow-hidden h-[400px]">
                            <img className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src={getArticleImage(secondaryStory || primaryStory)} alt={secondaryStory?.title || primaryStory?.title || 'Trending dispatch'} />
                            <div className="absolute bottom-0 right-0 bg-[#b32100] text-white px-6 py-3 border-l-4 border-t-4 border-black font-['Space_Grotesk'] font-bold uppercase">
                                {secondaryStory?.source?.name ? `${secondaryStory.source.name.toUpperCase()} // NOW` : 'FEATURED STORY'}
                            </div>
                        </div>
                        <div className="md:col-span-2 border-4 border-black relative group overflow-hidden h-[400px]">
                            <img className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src={getArticleImage(tertiaryStory || primaryStory)} alt={tertiaryStory?.title || primaryStory?.title || 'Trending dispatch'} />
                            <div className="absolute bottom-0 right-0 bg-white text-black px-4 py-2 border-l-4 border-t-4 border-black font-['Space_Grotesk'] text-xs font-bold uppercase">
                                {tertiaryStory?.source?.name ? `${tertiaryStory.source.name.toUpperCase()} // TRENDING` : 'TRENDING STORY'}
                            </div>
                        </div>
                    </div>
                </section>

                {/* FINAL CTA */}
                <section className="border-y-4 border-black bg-[#ebe8e3] px-6 py-32 flex flex-col items-center">
                    <h2 className="font-['Fraunces'] text-7xl font-black uppercase mb-12 text-center tracking-tighter italic">
                        Ready for the <span className="text-[#b32100]">Untangled</span> Truth?
                    </h2>
                    <div className="flex gap-4">
                        <Link to="/onboarding" className="bg-black text-white border-4 border-black px-12 py-4 font-['Space_Grotesk'] uppercase font-bold text-xl hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all shadow-[8px_8px_0px_0px_#FF3300]">
                            JOIN THE NETWORK
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="max-w-[1440px] mx-auto border-x-4 border-black bg-white">
                <div className="px-6 py-4 border-t-4 border-black flex justify-between items-center bg-black text-white">
                    <span className="font-['Space_Grotesk'] uppercase text-xs font-bold tracking-widest">{`© ${currentYear} CURATE EDITORIAL GROUP. ALL RIGHTS RESERVED.`}</span>
                    <div className="flex gap-6">
                        <span className="font-bold cursor-pointer hover:text-[#b32100]">X</span>
                        <span className="font-bold cursor-pointer hover:text-[#b32100]">IG</span>
                        <span className="font-bold cursor-pointer hover:text-[#b32100]">LI</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
