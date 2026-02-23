import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { useTopics } from '../hooks/useTopics';
import { preferencesService } from '../services/api';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4 }
    }
};

const TOPIC_GROUPS = [
    { id: 'all', label: 'All', topicIds: null },
    { id: 'tech', label: 'Tech', topicIds: ['technology', 'ai', 'programming', 'gadgets', 'cybersecurity'] },
    { id: 'business', label: 'Business', topicIds: ['business', 'finance', 'startups', 'crypto'] },
    { id: 'gaming', label: 'Gaming', topicIds: ['gaming', 'esports', 'anime'] },
    { id: 'science', label: 'Science', topicIds: ['science', 'space', 'health', 'environment'] },
    { id: 'culture', label: 'Culture', topicIds: ['entertainment', 'movies', 'music', 'travel', 'food', 'sports'] },
    { id: 'news', label: 'News', topicIds: ['news', 'politics'] },
];

function OnboardingPage() {
    const navigate = useNavigate();
    const { topics, loading } = useTopics();
    const [selected, setSelected] = useState([]);
    const [activeGroup, setActiveGroup] = useState('tech');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const toggleTopic = (id) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(tid => tid !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const handleFinish = async () => {
        setSubmitError('');
        setIsSubmitting(true);
        try {
            await preferencesService.updateTopics(selected);
            navigate('/feed');
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401) {
                navigate('/login');
                return;
            }
            setSubmitError(
                error?.response?.data?.message || 'Could not save your topics. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const isReady = selected.length >= 3;
    const currentGroup = TOPIC_GROUPS.find((group) => group.id === activeGroup) || TOPIC_GROUPS[0];
    const visibleTopics = currentGroup.topicIds
        ? topics.filter((topic) => currentGroup.topicIds.includes(topic.id))
        : topics;

    return (
        <main className="onboarding-container">
            <motion.div
                className="onboarding-content"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.header className="onboarding-header" variants={itemVariants}>
                    <h1>Pick Your Brief.</h1>
                    <p>Choose at least 3 interests. We grouped topics so you can set up faster.</p>
                </motion.header>

                <motion.section className="topics-section" variants={itemVariants}>
                    {loading ? (
                        <div className="loading-spinner"></div>
                    ) : (
                        <>
                            <div className="onboarding-group-tabs">
                                {TOPIC_GROUPS.map((group) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        className={`onboarding-group-tab ${activeGroup === group.id ? 'active' : ''}`}
                                        onClick={() => setActiveGroup(group.id)}
                                    >
                                        {group.label}
                                    </button>
                                ))}
                            </div>

                            {selected.length > 0 && (
                                <div className="onboarding-selected-strip">
                                    {selected.map((topicId) => {
                                        const topic = topics.find((item) => item.id === topicId);
                                        if (!topic) return null;
                                        return (
                                            <button
                                                key={topic.id}
                                                type="button"
                                                className="selected-topic-chip"
                                                onClick={() => toggleTopic(topic.id)}
                                            >
                                                {topic.icon} {topic.name} ×
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="topic-grid onboarding-topic-grid">
                                {visibleTopics.map((topic) => {
                                    const isSelected = selected.includes(topic.id);
                                    return (
                                        <motion.button
                                            key={topic.id}
                                            className={`topic-card ${isSelected ? 'active' : ''}`}
                                            onClick={() => toggleTopic(topic.id)}
                                            layout
                                        >
                                            <span className="topic-icon">{topic.icon || '#'}</span>
                                            <span className="topic-name">{topic.name}</span>
                                            {isSelected && (
                                                <motion.div
                                                    className="check-badge"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    ✓
                                                </motion.div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </motion.section>

                {submitError && (
                    <motion.div className="auth-error" variants={itemVariants}>
                        {submitError}
                    </motion.div>
                )}

                <motion.footer className="onboarding-footer" variants={itemVariants}>
                    <AnimatePresence>
                        {isReady && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="onboarding-ready-indicator is-ready"
                            >
                                <div className="ready-pulse"></div>
                                <span>Brief Ready</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        className={`continue-btn ${isReady ? 'ready' : ''}`}
                        disabled={!isReady || isSubmitting}
                        onClick={handleFinish}
                    >
                        {isSubmitting ? 'Saving...' : `Continue (${selected.length}/3)`}
                    </button>
                </motion.footer>
            </motion.div>
        </main>
    );
}

export default OnboardingPage;
