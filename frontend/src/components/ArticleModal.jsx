import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { interactionService } from '../services/api';
import { getResolvedArticleImage } from '../utils/articleImages';

function formatFullDate(dateString) {
    if (!dateString) return 'Date unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function formatReadingTime(minutes) {
    if (!minutes || minutes < 1) return 'Quick read';
    return `${Math.round(minutes)} min read`;
}

function ArticleModal({ article, onClose }) {
    if (!article) return null;

    const { 
        _id, 
        title = 'Untitled Article', 
        imageUrl, 
        source, 
        publishedAt, 
        summary, 
        summaryStatus,
        description,
        author,
        url, 
        content, 
        topics 
    } = article;

    const [reaction, setReaction] = useState(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    
    const openTimeRef = useRef(Date.now());

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow || 'unset';
            if (_id) {
                const duration = Math.max(1, Math.round((Date.now() - openTimeRef.current) / 1000));
                interactionService.trackView(_id, duration).catch(() => {});
            }
        };
    }, [_id, onClose]);

    const handleAction = (type) => (e) => {
        e.stopPropagation();
        if (type === 'like') {
            setReaction(reaction === 'like' ? null : 'like');
            if (reaction !== 'like') interactionService.like(_id).catch(() => {});
        } else if (type === 'bookmark') {
            setIsBookmarked(!isBookmarked);
            if (!isBookmarked) interactionService.bookmark(_id).catch(() => {});
        }
    };

    const sourceName = source?.name || 'External Source';
    const bodyContent = typeof content?.text === 'string' ? content.text : '';
    const readingTime = formatReadingTime(content?.readingTimeMinutes);
    const hasAiSummary = Boolean(
        summaryStatus === 'COMPLETED' &&
        summary?.text &&
        ((Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0) ||
            summary.text !== description)
    );
    const synopsisLabel = hasAiSummary ? 'AI Synopsis' : 'Source Synopsis';
    const synopsisText = hasAiSummary
        ? summary?.text || ''
        : description || summary?.text || '';
    const keyPoints = hasAiSummary && Array.isArray(summary?.keyPoints)
        ? summary.keyPoints.filter(Boolean).slice(0, 4)
        : [];
    const confidenceLabel = hasAiSummary ? 'Generated summary' : 'Source summary';
    const confidenceValue = hasAiSummary ? `${Math.max(1, keyPoints.length)} key points` : 'From the original article';
    const heroImage = getResolvedArticleImage(article, '1400/900');
    const heroImageUrl = heroImage.url;
    const heroSizeClass = hasAiSummary ? 'max-h-[360px]' : 'max-h-[620px]';
    const heroCaption = heroImage.isPlaceholder ? 'Curate visual placeholder' : sourceName;
    const topicList = Array.isArray(topics) ? topics.filter((topic) => topic?.name).slice(0, 8) : [];

    return createPortal(
        <motion.div 
            className="fixed inset-0 z-[10000] flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
            
            <motion.div 
                className="relative w-[95vw] max-w-[1600px] h-screen bg-[#fdf9f4] border-l-4 border-black flex flex-col shadow-[-20px_0_0px_#111] overflow-hidden font-['Work_Sans']"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
                {/* Header */}
                <header className="flex flex-col items-center w-full pt-8 pb-4 px-10 border-b-4 border-black bg-[#fdf9f4]">
                    <div className="w-full flex justify-between items-center mb-8">
                        <div className="text-7xl font-black tracking-tighter font-['Newsreader'] italic">CURATE</div>
                        <div className="flex items-center gap-6">
                            <span className="font-['Space_Grotesk'] uppercase tracking-widest text-[11px] font-bold">{`Article view // ${new Date().getFullYear()}`}</span>
                            <button onClick={onClose} className="bg-black text-white px-4 py-2 font-['Space_Grotesk'] font-bold text-xs uppercase hover:bg-[#b32100]">CLOSE [ESC]</button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden grid grid-cols-10">
                    {/* Left Col: Metadata */}
                    <aside className="col-span-2 border-r-4 border-black pr-8 py-12 flex flex-col gap-12 pl-10 overflow-y-auto">
                        <div>
                            <h3 className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-widest mb-6 text-[#b32100]">Article details</h3>
                            <div className="flex flex-col gap-8">
                                <div className="border-4 border-black p-4 bg-[#f1ede8]">
                                    <p className="font-['Space_Grotesk'] text-[10px] uppercase opacity-60">Source</p>
                                    <p className="font-['Newsreader'] text-2xl font-bold italic">{sourceName}</p>
                                </div>
                                <div className="border-4 border-black p-4 bg-[#f1ede8]">
                                    <p className="font-['Space_Grotesk'] text-[10px] uppercase opacity-60">Summary</p>
                                    <p className="font-['Newsreader'] text-3xl font-bold italic">{confidenceValue}</p>
                                    <p className="font-['Space_Grotesk'] text-[10px] uppercase opacity-60 mt-2">{confidenceLabel}</p>
                                </div>
                                <div className="border-4 border-black p-4 bg-[#f1ede8]">
                                    <p className="font-['Space_Grotesk'] text-[10px] uppercase opacity-60">Reading info</p>
                                    <p className="font-['Newsreader'] text-xl font-bold italic">{readingTime}</p>
                                    <p className="font-['Space_Grotesk'] text-[10px] uppercase opacity-60 mt-2">{author ? `BY ${author}` : 'AUTHOR UNAVAILABLE'}</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-widest mb-6">Topics</h3>
                            <div className="flex flex-col gap-4">
                                {topicList.length > 0 ? topicList.map((t, i) => (
                                    <div key={i} className="p-3 bg-[#f1ede8] border-2 border-black">
                                        <span className="font-['Space_Grotesk'] text-[10px] uppercase block">#{t.name?.toUpperCase()}</span>
                                    </div>
                                )) : (
                                    <div className="p-3 bg-[#f1ede8] border-2 border-black">
                                        <span className="font-['Space_Grotesk'] text-[10px] uppercase block">No topics available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Main Body */}
                    <main className="col-span-6 px-16 py-12 overflow-y-auto bg-[#fdf9f4]">
                        <div className="w-full mb-12">
                            <div className="font-['Space_Grotesk'] uppercase tracking-[0.2em] text-[#b32100] font-bold mb-4">{sourceName}</div>
                            <h1 className="font-['Newsreader'] text-[5rem] leading-[0.9] font-black tracking-tighter mb-8 italic">{title}</h1>
                            <div className="font-['Space_Grotesk'] text-sm uppercase opacity-60">{formatFullDate(publishedAt)}</div>
                        </div>

                        {heroImageUrl && (
                            <div className="w-full mb-16 border-4 border-black overflow-hidden bg-white">
                                <img className={`w-full ${heroSizeClass} object-cover`} src={heroImageUrl} alt="" />
                                <div className="border-t-4 border-black px-4 py-3 bg-[#f1ede8] font-['Space_Grotesk'] text-[10px] uppercase tracking-widest">
                                    {heroCaption}
                                </div>
                            </div>
                        )}

                        <div className="max-w-2xl mx-auto font-['Newsreader']">
                            {synopsisText && (
                                <div className="mb-12 border-l-4 border-[#b32100] pl-8">
                                    <div className="font-['Space_Grotesk'] uppercase tracking-[0.2em] text-[#b32100] font-bold mb-4 text-xs">{synopsisLabel}</div>
                                    <p className="text-3xl leading-relaxed italic font-medium">
                                        {synopsisText}
                                    </p>
                                    {keyPoints.length > 0 && (
                                        <ul className="mt-8 space-y-4 font-['Work_Sans'] text-base uppercase tracking-wide">
                                            {keyPoints.map((point, index) => (
                                                <li key={index}>[{String(index + 1).padStart(2, '0')}] {point}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            <div className="text-xl leading-loose opacity-90 space-y-8" dangerouslySetInnerHTML={{ __html: bodyContent }} />
                            {!bodyContent && <p className="italic opacity-50">Please refer to the original source for full coverage.</p>}
                        </div>
                    </main>

                    {/* Right Col: Actions */}
                    <aside className="col-span-2 border-l-4 border-black pl-8 py-12 flex flex-col gap-12 pr-10 overflow-y-auto">
                        <div>
                            <h3 className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-widest mb-6">Actions</h3>
                            <div className="flex flex-col gap-4">
                                <button onClick={() => window.open(url, '_blank')} className="w-full p-4 border-4 border-black bg-black text-white font-['Space_Grotesk'] font-bold uppercase tracking-widest hover:bg-[#b32100] transition-all">
                                    Read Original
                                </button>
                                <button onClick={handleAction('like')} className={`w-full p-4 border-4 border-black font-['Space_Grotesk'] font-bold uppercase tracking-widest transition-all ${reaction === 'like' ? 'bg-[#b32100] text-white' : 'bg-white'}`}>
                                    {reaction === 'like' ? 'Liked' : 'Like'}
                                </button>
                                <button onClick={handleAction('bookmark')} className={`w-full p-4 border-4 border-black font-['Space_Grotesk'] font-bold uppercase tracking-widest transition-all ${isBookmarked ? 'bg-[#b32100] text-white' : 'bg-white'}`}>
                                    {isBookmarked ? 'Saved' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
}

export default ArticleModal;
