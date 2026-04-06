import { useState, useMemo } from 'react';
import { interactionService } from '../services/api';
import { getResolvedArticleImage } from '../utils/articleImages';

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * NewsCard Component
 * Modern Bento-style card
 */
function NewsCard({ article, relevance, onClick, variant = 'standard', className = '' }) {
  const [imageError, setImageError] = useState(false);
  const [placeholderError, setPlaceholderError] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const {
    _id,
    title,
    imageUrl,
    source,
    publishedAt,
    summary,
    summaryStatus,
  } = article;

  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
    } else {
      setPlaceholderError(true);
    }
  };

  // Interaction handlers
  const handleLike = (e) => {
    e.stopPropagation();
    const newReaction = reaction === 'like' ? null : 'like';
    setReaction(newReaction);
    if (newReaction === 'like') interactionService.like(_id).catch(console.error);
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    if (!isBookmarked) interactionService.bookmark(_id).catch(console.error);
  };

  const handleCardClick = () => {
    interactionService.trackClick(_id).catch(console.error);
    onClick(article);
  };

  const hasAiSummary = Boolean(
    summaryStatus === 'COMPLETED' &&
    summary?.text &&
    ((Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0) ||
      summary.text !== article.description)
  );
  const summaryText = hasAiSummary ? summary?.text || '' : article.description || summary?.text || '';
  const sourceName = source?.name || 'Unknown Source';
  const normalizedImportance = Number.isFinite(Number(article?.importanceScore))
    ? Number(article.importanceScore)
    : Number(relevance?.score || 0);
  const scorePercent = Math.round(Math.max(0, Math.min(1, normalizedImportance)) * 100);
  const significanceLabel =
    variant === 'hero'
      ? 'Top story'
      : variant === 'medium'
        ? 'Editor pick'
        : 'Brief';

  const displayImageUrl = useMemo(() => {
    if (imageUrl && !imageError) return imageUrl;
    return getResolvedArticleImage(article, '800/600').url;
  }, [imageUrl, imageError, article]);

  const variantClass = `card-variant-${variant}`;

  return (
    <article
      className={`news-card ${variantClass} ${className}`}
      onClick={handleCardClick}
    >
      <div className="card-background">
        {!placeholderError ? (
          <img
            src={displayImageUrl}
            alt={title}
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="card-placeholder-gradient" />
        )}
      </div>

      <div className="card-content-overlay">
        <div className="card-header">
          <div className="card-signal-stack">
            <span className="match-pill">{scorePercent}% importance</span>
            <span className={`signal-pill signal-${variant}`}>{significanceLabel}</span>
          </div>
          <div className="card-actions-mini">
            <button
              onClick={handleLike}
              className={reaction === 'like' ? 'active' : ''}
              aria-label="Like article"
            >
              {reaction === 'like' ? 'LIKED' : 'LIKE'}
            </button>
            <button
              onClick={handleBookmark}
              className={isBookmarked ? 'active' : ''}
              aria-label="Bookmark article"
            >
              {isBookmarked ? 'SAVED' : 'SAVE'}
            </button>
          </div>
        </div>

        <div className="card-info">
          <div className="card-meta">
            <span className="source">{sourceName}</span>
            <span className="dot">•</span>
            <span className="time">{formatRelativeTime(publishedAt)}</span>
          </div>
          <h3 className="title">{title}</h3>

          {variant === 'hero' && (
            <p className="summary">{summaryText}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default NewsCard;
