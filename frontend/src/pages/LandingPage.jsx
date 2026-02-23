import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { authService } from '../services/api';

function LandingPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect if already logged in
        if (authService.isAuthenticated()) {
            navigate('/feed');
        }
    }, [navigate]);

    return (
        <div className="landing-page">
            <div className="landing-grid-bg" />

            <nav className="landing-nav">
                <div className="landing-logo">
                    <span className="landing-logo-mark"></span>
                    Curate
                </div>
                <div className="nav-actions">
                    <Link to="/login" className="nav-link">Sign In</Link>
                    <Link to="/onboarding" className="nav-cta-btn">Get Started</Link>
                </div>
            </nav>

            <section className="hero-wrapper">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="hero-meta">
                        <span>Edition 01</span>
                        <div className="hero-meta-line" />
                        <span>The Signal</span>
                    </div>

                    <h1 className="hero-title">
                        Cut <br />
                        <span className="outline">Through</span> <br />
                        The Noise.
                    </h1>
                </motion.div>

                <div className="hero-bottom-row">
                    <motion.p
                        className="hero-subtitle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                    >
                        Algorithms optimized for attention span have ruined reading. Curate restores control, delivering precise, AI-distilled briefs tailored to your actual interests.
                    </motion.p>

                    <motion.div
                        className="hero-cta-group"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        <Link to="/onboarding" className="btn-primary-stark">Build Your Brief</Link>
                        <Link to="/login" className="btn-secondary-stark">Explore Demo</Link>
                    </motion.div>
                </div>
            </section>

            <section className="manifesto-section">
                <div className="manifesto-label">The Problem</div>
                <motion.div
                    className="manifesto-text"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                >
                    Information obesity is the defining crisis of the modern web. <span>We consume constantly, yet understand less. Curate strips away the infinite scroll, leaving only what matters.</span>
                </motion.div>
            </section>

            <section className="features-section">
                <div className="features-grid">
                    <div className="feature-block">
                        <div className="feature-number">01</div>
                        <div>
                            <h3 className="feature-title">Algorithmic Sobriety</h3>
                            <p className="feature-desc">Our engine tracks deep reading metrics—duration, completion, interaction—to rank stories by substance, not click-through rates.</p>
                        </div>
                    </div>

                    <div className="feature-block">
                        <div className="feature-number">02</div>
                        <div>
                            <h3 className="feature-title">AI Distillation</h3>
                            <p className="feature-desc">Opaque headlines are rewritten for clarity. Lengthy articles are condensed into high-density insights before you commit to reading.</p>
                        </div>
                    </div>

                    <div className="feature-block">
                        <div className="feature-number">03</div>
                        <div>
                            <h3 className="feature-title">Real-Time Search</h3>
                            <p className="feature-desc">Break out of your filter bubble on demand. Query any topic instantly and retrieve a tailored brief on breaking developments.</p>
                        </div>
                    </div>

                    <div className="feature-block">
                        <div className="feature-number">04</div>
                        <div>
                            <h3 className="feature-title">Utilitarian Analytics</h3>
                            <p className="feature-desc">Monitor your intellectual diet. Uncover which publications and topics actually hold your attention over time.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="data-showcase">
                <div className="data-panel">
                    <div className="data-header">Current Analysis Feed</div>
                    <div className="data-row">
                        <div className="data-score">98%</div>
                        <div>
                            <div className="data-title">LLM Parameter Architectures</div>
                            <div className="data-source">AI Research Journal &middot; 2 Min Summary</div>
                        </div>
                    </div>
                    <div className="data-row">
                        <div className="data-score">94%</div>
                        <div>
                            <div className="data-title">Federal Reserve Rate Adjustments</div>
                            <div className="data-source">Global Markets &middot; 3 Min Summary</div>
                        </div>
                    </div>
                    <div className="data-row" style={{ borderBottom: 'none' }}>
                        <div className="data-score">82%</div>
                        <div>
                            <div className="data-title">Solid State Battery Breakthroughs</div>
                            <div className="data-source">Tech Review &middot; 1 Min Summary</div>
                        </div>
                    </div>
                </div>

                <div className="data-panel" style={{ background: 'var(--bg-primary)' }}>
                    <div className="data-header">System Status</div>
                    <div className="data-row">
                        <div className="data-score">V</div>
                        <div>
                            <div className="data-title">Curate Engine 2.1</div>
                            <div className="data-source">Status: Online</div>
                        </div>
                    </div>
                    <div className="data-row">
                        <div className="data-score">T</div>
                        <div>
                            <div className="data-title">42 Topics Tracked</div>
                            <div className="data-source">User Preference Matrix</div>
                        </div>
                    </div>
                    <div className="data-row" style={{ borderBottom: 'none' }}>
                        <div className="data-score">S</div>
                        <div>
                            <div className="data-title">Summarizer Active</div>
                            <div className="data-source">Latency: 140ms</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bottom-cta">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2>Reclaim Your Focus.</h2>
                    <Link to="/onboarding" className="btn-primary-stark">Initialize Curate</Link>
                </motion.div>
            </section>

            <footer className="landing-footer-stark">
                <div>Curate Inc. &copy; 2026</div>
                <div>System Operated</div>
                <div>Index 01</div>
            </footer>
        </div>
    );
}

export default LandingPage;
