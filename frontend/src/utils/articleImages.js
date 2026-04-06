export function getArticlePlaceholderImage(article, dimensions = '1400/900') {
  const seed = article?.title
    ? article.title.slice(0, 24).replace(/\s/g, '')
    : 'curate-article';

  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${dimensions}`;
}

export function getResolvedArticleImage(article, dimensions = '1400/900') {
  if (article?.imageUrl) {
    return {
      url: article.imageUrl,
      isPlaceholder: false,
    };
  }

  return {
    url: getArticlePlaceholderImage(article, dimensions),
    isPlaceholder: true,
  };
}
