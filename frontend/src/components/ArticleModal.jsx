import { useEffect, useState, useRef } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { interactionService } from '../services/api';

function formatFullDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ArticleModal({ article, onClose }) {
    const {
        _id,
        title,
        imageUrl,
        source,
        publishedAt,
        summary,
        url,
        content,
        topics,
    } = article;

    const [reaction, setReaction] = useState(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const openTimeRef = useRef(0);
    const trackedViewRef = useRef(false);
    const maxScrollDepthRef = useRef(0);
    const contentRef = useRef(null);
    const closeBtnRef = useRef(null);
    const previousFocusedElementRef = useRef(null);
    const titleId = `article-modal-title-${_id}`;

    // Lock body scroll when modal is open
    useEffect(() => {
        openTimeRef.current = Date.now();
        previousFocusedElementRef.current = document.activeElement;
        document.body.style.overflow = 'hidden';

        const timer = setTimeout(() => {
            closeBtnRef.current?.focus();
        }, 0);

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleClose();
                return;
            }

            if (event.key === 'Tab' && contentRef.current) {
                const focusable = contentRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
            if (previousFocusedElementRef.current?.focus) {
                previousFocusedElementRef.current.focus();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const trackViewIfNeeded = () => {
        if (trackedViewRef.current) return;
        trackedViewRef.current = true;
        const duration = Math.max(1, Math.round((Date.now() - openTimeRef.current) / 1000));
        if (duration < 2) {
            return;
        }
        const scrollDepth = maxScrollDepthRef.current > 0
            ? Math.round(maxScrollDepthRef.current)
            : null;
        interactionService.trackView(_id, duration, scrollDepth).catch(console.error);
    };

    const handleProseScroll = (event) => {
        const target = event.currentTarget;
        const maxScrollable = target.scrollHeight - target.clientHeight;
        if (maxScrollable <= 0) {
            maxScrollDepthRef.current = 100;
            return;
        }
        const depth = Math.min(100, (target.scrollTop / maxScrollable) * 100);
        if (depth > maxScrollDepthRef.current) {
            maxScrollDepthRef.current = depth;
        }
    };

    function handleClose() {
        trackViewIfNeeded();
        onClose();
    }

    const handleLike = () => {
        const newReaction = reaction === 'like' ? null : 'like';
        setReaction(newReaction);
        if (newReaction === 'like') interactionService.like(_id).catch(console.error);
    };

    const handleDislike = () => {
        const newReaction = reaction === 'dislike' ? null : 'dislike';
        setReaction(newReaction);
        if (newReaction === 'dislike') interactionService.dislike(_id).catch(console.error);
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        if (!isBookmarked) interactionService.bookmark(_id).catch(console.error);
    };

    const handleOpenOriginal = () => {
        interactionService.trackClick(_id, 0).catch(console.error);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const summaryText = summary?.text || article.description || '';
    const keyPoints = summary?.keyPoints || [];
    const fullContent = content?.text || '';

    return (
        <div className="article-modal-backdrop" onClick={handleClose}>
            <motion.div
                className="article-modal-content"
                ref={contentRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
                {/* Close Button */}
                <button
                    ref={closeBtnRef}
                    className="modal-close-btn"
                    onClick={handleClose}
                    aria-label="Close article modal"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {/* Hero Image */}
                {imageUrl && (
                    <div className="modal-hero-image">
                        <img src={imageUrl} alt={title} />
                        <div className="modal-hero-overlay"></div>
                    </div>
                )}

                <div className="modal-body">
                    {/* Header Info */}
                    <div className="modal-header-info">
                        <span className="source-badge">{source?.name || 'Unknown Source'}</span>
                        <span className="date-text">{formatFullDate(publishedAt)}</span>
                    </div>

                    <h1 id={titleId} className="modal-title">{title}</h1>

                    {/* Topics */}
                    {topics && topics.length > 0 && (
                        <div className="modal-topics">
                            {topics.map((t, i) => (
                                <span key={i} className="modal-topic-tag">#{t.name}</span>
                            ))}
                        </div>
                    )}

                    {/* AI Summary Section */}
                    <div className="ai-summary-block">
                        <div className="ai-summary-header">
                            <span className="sparkle-icon">✨</span>
                            <h3>AI Summary</h3>
                        </div>
                        <p className="summary-text">{summaryText}</p>
                        {keyPoints.length > 0 && (
                            <ul className="key-points-list">
                                {keyPoints.map((point, idx) => (
                                    <li key={idx}>{point}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="modal-divider"></div>

                    {/* Full Content or Description */}
                    <div className="article-prose" onScroll={handleProseScroll}>
                        {fullContent ? (
                            <div dangerouslySetInnerHTML={{ __html: fullContent }} />
                        ) : (
                            <p>Click "Read full article" to view the original content.</p>
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="modal-footer-actions">
                        <button className="read-original-btn" onClick={handleOpenOriginal}>
                            Read full article on {source?.name}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </button>

                        <div className="interaction-bar">
                            <button
                                className={`action-btn-lg like-btn ${reaction === 'like' ? 'active' : ''}`}
                                onClick={handleLike}
                                title="Like"
                                aria-label="Like article"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill={reaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                </svg>
                            </button>
                            <button
                                className={`action-btn-lg dislike-btn ${reaction === 'dislike' ? 'active' : ''}`}
                                onClick={handleDislike}
                                title="Dislike"
                                aria-label="Dislike article"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill={reaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                                </svg>
                            </button>
                            <button
                                className={`action-btn-lg bookmark-btn ${isBookmarked ? 'active' : ''}`}
                                onClick={handleBookmark}
                                title="Bookmark"
                                aria-label="Bookmark article"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default ArticleModal;
