import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import ticketRoutes from './routes/tickets'
import knowledgeRoutes from './routes/knowledge'
import conversationRoutes from './routes/conversations'
import settingsRoutes from './routes/settings'
import statsRoutes from './routes/stats'
import chatRoutes from './routes/chat'
import billingRoutes from './routes/billing'
import widgetRoutes from './routes/widget'
import integrationsRoutes from './routes/integrations'
import type { Env } from './lib/middleware'

const app = new Hono<{ Bindings: Env }>()

// ---- CORS --------------------------------------------------
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}))

// ---- Static & Favicon --------------------------------------
app.use('/static/*', serveStatic({ root: './public' }))

app.get('/favicon.ico', (c) => new Response(null, { status: 204 }))
app.get('/favicon.svg', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6a4cf5"/><stop offset="100%" stop-color="#d44df0"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M16 8 L20 14 L14 14 L18 20 L10 14 L16 14 Z" fill="white"/></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
})

// ---- Health ------------------------------------------------
app.get('/api/health', (c) => c.json({
  status: 'ok', service: 'SupportIQ',
  version: '2.0.0',
  db: c.env.DB ? 'connected' : 'not_configured',
  storage: c.env.STORAGE ? 'connected' : 'not_configured',
  ai: c.env.OPENAI_API_KEY ? 'enabled' : 'disabled',
  vector_search: !!(c.env.QDRANT_URL && c.env.QDRANT_API_KEY),
  timestamp: new Date().toISOString()
}))

// ---- API Routes --------------------------------------------
// Phase 1: Core
app.route('/api/auth', authRoutes)
app.route('/api/tickets', ticketRoutes)
app.route('/api/knowledge-bases', knowledgeRoutes)
app.route('/api/conversations', conversationRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/stats', statsRoutes)
// Phase 2: AI
app.route('/api/chat', chatRoutes)
// Phase 4: Billing
app.route('/api/billing', billingRoutes)
// Phase 5: Widget
app.route('/api/widget', widgetRoutes)
// Phase 6: Integrations (Slack, Webhooks, SSO)
app.route('/api/integrations', integrationsRoutes)

// ---- Page Routes -------------------------------------------
const pages = ['/', '/pricing', '/login', '/signup', '/dashboard', '/dashboard/inbox', '/dashboard/tickets', '/dashboard/knowledge-base', '/dashboard/analytics', '/dashboard/settings', '/widget']

// Landing page HTML generator
function getLandingHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SupportIQ — AI-Powered Customer Support Platform</title>
  <meta name="description" content="Deploy intelligent AI support agents that resolve 80% of tickets automatically. Built for modern SaaS companies.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            canvas: '#090909',
            'surface-1': '#141414',
            'surface-2': '#1c1c1c',
            hairline: '#262626',
            'hairline-soft': '#1a1a1a',
            'ink': '#ffffff',
            'ink-muted': '#999999',
            'accent-blue': '#0099ff',
            'gradient-violet': '#6a4cf5',
            'gradient-magenta': '#d44df0',
            'gradient-orange': '#ff7a3d',
            'gradient-coral': '#ff5577',
            'semantic-success': '#22c55e',
          },
          borderRadius: {
            'pill': '100px',
            'xxl': '30px',
          },
          fontFamily: {
            'inter': ['Inter', 'system-ui', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #090909; color: #ffffff; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    
    .display-xxl { font-size: clamp(52px, 8vw, 110px); font-weight: 500; line-height: 0.88; letter-spacing: -4px; }
    .display-lg { font-size: clamp(36px, 5vw, 62px); font-weight: 500; line-height: 0.9; letter-spacing: -2.5px; }
    .display-md { font-size: clamp(24px, 3vw, 32px); font-weight: 500; line-height: 1.1; letter-spacing: -1px; }
    
    .btn-primary { background: #ffffff; color: #000000; border-radius: 100px; padding: 12px 24px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; white-space: nowrap; }
    .btn-primary:hover { background: #f0f0f0; transform: translateY(-1px); }
    .btn-secondary { background: #1c1c1c; color: #ffffff; border-radius: 100px; padding: 12px 24px; font-size: 14px; font-weight: 500; border: 1px solid #262626; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; white-space: nowrap; }
    .btn-secondary:hover { background: #262626; transform: translateY(-1px); }
    
    .gradient-violet-card { background: linear-gradient(135deg, #6a4cf5 0%, #d44df0 100%); border-radius: 30px; }
    .gradient-magenta-card { background: linear-gradient(135deg, #d44df0 0%, #ff5577 100%); border-radius: 30px; }
    .gradient-orange-card { background: linear-gradient(135deg, #ff7a3d 0%, #ff5577 100%); border-radius: 30px; }
    
    .surface-1 { background: #141414; }
    .surface-2 { background: #1c1c1c; }
    
    .card { background: #141414; border: 1px solid #1a1a1a; border-radius: 20px; }
    .card-elevated { background: #1c1c1c; border: 1px solid #262626; border-radius: 20px; }
    
    .nav-link { color: #999999; font-size: 14px; text-decoration: none; transition: color 0.2s; }
    .nav-link:hover { color: #ffffff; }
    
    /* Animations */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
    @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(106, 76, 245, 0.3); } 50% { box-shadow: 0 0 40px rgba(106, 76, 245, 0.6); } }
    @keyframes typing { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    
    .fade-up { animation: fadeInUp 0.6s ease forwards; }
    .float-anim { animation: float 6s ease-in-out infinite; }
    .pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
    
    .gradient-text { background: linear-gradient(135deg, #ffffff 0%, #999999 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .gradient-text-violet { background: linear-gradient(135deg, #6a4cf5, #d44df0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    
    .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #999; display: inline-block; animation: typing 1.4s infinite ease-in-out; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    
    .stat-badge { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 100px; padding: 2px 10px; font-size: 12px; font-weight: 500; }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #090909; }
    ::-webkit-scrollbar-thumb { background: #262626; border-radius: 2px; }
    
    /* Mobile nav */
    #mobile-menu { display: none; }
    #mobile-menu.open { display: flex; }
    
    @media (max-width: 810px) {
      .hide-mobile { display: none; }
      .display-xxl { font-size: 48px; letter-spacing: -2.5px; }
      .display-lg { font-size: 36px; letter-spacing: -1.5px; }
      .display-md { font-size: 24px; letter-spacing: -0.8px; }
      .section-pad { padding: 64px 20px; }
      .hero-pad { padding: 100px 20px 64px; }
      .grid-2 { grid-template-columns: 1fr !important; }
      .grid-3 { grid-template-columns: 1fr !important; }
    }
    
    /* Grid helpers */
    .grid-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 1024px) { .grid-features { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .grid-features { grid-template-columns: 1fr; } }
    
    .grid-pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 900px) { .grid-pricing { grid-template-columns: 1fr; } }
    
    /* Glow effects */
    .hero-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(106, 76, 245, 0.12) 0%, transparent 70%); pointer-events: none; }
    
    .shimmer-line { height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); background-size: 200% 100%; animation: shimmer 2s infinite; }
  </style>
</head>
<body>

<!-- ============ NAVIGATION ============ -->
<nav style="position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(9,9,9,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid #1a1a1a; height: 56px; display: flex; align-items: center;">
  <div style="max-width: 1200px; margin: 0 auto; width: 100%; padding: 0 24px; display: flex; align-items: center; justify-content: space-between;">
    <!-- Logo -->
    <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none;">
      <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <i class="fas fa-bolt" style="color: white; font-size: 13px;"></i>
      </div>
      <span style="font-size: 16px; font-weight: 600; color: #fff; letter-spacing: -0.5px;">SupportIQ</span>
    </a>
    
    <!-- Center Nav -->
    <div class="hide-mobile" style="display: flex; gap: 32px; align-items: center;">
      <a href="#features" class="nav-link">Features</a>
      <a href="#pricing" class="nav-link">Pricing</a>
      <a href="#" class="nav-link">Docs</a>
      <a href="#" class="nav-link">Blog</a>
    </div>
    
    <!-- Right CTA -->
    <div style="display: flex; gap: 8px; align-items: center;">
      <a href="/login" class="btn-secondary hide-mobile" style="padding: 8px 18px;">Sign in</a>
      <a href="/signup" class="btn-primary" style="padding: 8px 18px;">Start Free Trial</a>
      <!-- Hamburger -->
      <button id="hamburger" onclick="toggleMobileMenu()" class="hide-mobile" style="display: none; background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; padding: 4px;">
        <i class="fas fa-bars"></i>
      </button>
    </div>
  </div>
</nav>

<!-- Mobile Menu -->
<div id="mobile-menu" style="position: fixed; top: 56px; left: 0; right: 0; z-index: 99; background: #141414; border-bottom: 1px solid #262626; padding: 16px 24px; flex-direction: column; gap: 16px;">
  <a href="#features" class="nav-link" style="font-size: 16px; padding: 8px 0;">Features</a>
  <a href="#pricing" class="nav-link" style="font-size: 16px; padding: 8px 0;">Pricing</a>
  <a href="#" class="nav-link" style="font-size: 16px; padding: 8px 0;">Docs</a>
  <a href="/login" class="nav-link" style="font-size: 16px; padding: 8px 0;">Sign in</a>
  <a href="/signup" class="btn-primary" style="text-align: center; justify-content: center;">Start Free Trial</a>
</div>

<!-- ============ HERO SECTION ============ -->
<section style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 120px 24px 80px; position: relative; overflow: hidden;">
  <!-- Background glow -->
  <div class="hero-glow"></div>
  <div style="position: absolute; top: 20%; right: 10%; width: 300px; height: 300px; background: radial-gradient(circle, rgba(212, 77, 240, 0.08) 0%, transparent 70%); pointer-events: none;"></div>
  
  <div style="max-width: 1200px; margin: 0 auto; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;" class="grid-2">
    <!-- Left: Text -->
    <div class="fade-up">
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(106, 76, 245, 0.15); border: 1px solid rgba(106, 76, 245, 0.3); border-radius: 100px; padding: 6px 14px; margin-bottom: 32px;">
        <div style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%;"></div>
        <span style="font-size: 13px; color: #999;">AI-Powered Support Platform</span>
      </div>
      
      <h1 class="display-xxl" style="margin-bottom: 24px;">
        Resolve 80%<br>of tickets<br><span class="gradient-text-violet">automatically</span>
      </h1>
      
      <p style="font-size: 20px; color: #999; line-height: 1.6; margin-bottom: 40px; max-width: 480px;">
        Deploy intelligent AI support agents trained on your knowledge base. Seamless human handoff when it matters most.
      </p>
      
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 48px;">
        <a href="/signup" class="btn-primary" style="padding: 14px 28px; font-size: 15px;">
          <i class="fas fa-rocket"></i> Start Free Trial
        </a>
        <a href="#features" class="btn-secondary" style="padding: 14px 28px; font-size: 15px;">
          <i class="fas fa-play"></i> See Demo
        </a>
      </div>
      
      <!-- Social proof -->
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <div style="display: flex;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #6a4cf5, #d44df0); border: 2px solid #090909; display: flex; align-items: center; justify-content: center; font-size: 10px;">JS</div>
          <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #ff7a3d, #ff5577); border: 2px solid #090909; margin-left: -8px; display: flex; align-items: center; justify-content: center; font-size: 10px;">MK</div>
          <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #0099ff, #6a4cf5); border: 2px solid #090909; margin-left: -8px; display: flex; align-items: center; justify-content: center; font-size: 10px;">AL</div>
        </div>
        <div>
          <div style="display: flex; gap: 2px; color: #ff7a3d; font-size: 12px;">★★★★★</div>
          <div style="font-size: 12px; color: #666;">Trusted by 2,400+ companies</div>
        </div>
      </div>
    </div>
    
    <!-- Right: Product Mockup (Gradient Violet Card) -->
    <div class="float-anim" style="position: relative;">
      <div class="gradient-violet-card pulse-glow" style="padding: 2px;">
        <div style="background: #0f0f1a; border-radius: 28px; padding: 24px; overflow: hidden;">
          <!-- Chat widget mockup -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-bolt" style="color: white; font-size: 13px;"></i>
              </div>
              <div>
                <div style="font-size: 13px; font-weight: 600;">SupportIQ AI</div>
                <div style="font-size: 11px; color: #22c55e;">● Online</div>
              </div>
            </div>
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #1c1c1c; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <i class="fas fa-times" style="font-size: 10px; color: #666;"></i>
            </div>
          </div>
          
          <!-- Chat messages -->
          <div style="space-y: 12px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
            <div style="background: rgba(106, 76, 245, 0.2); border-radius: 12px 12px 12px 4px; padding: 12px 14px; max-width: 85%;">
              <div style="font-size: 12px; color: #ccc; line-height: 1.5;">Hi! I need help resetting my password. It's been 30 minutes and I haven't received the email.</div>
              <div style="margin-top: 6px; display: flex; gap: 4px; align-items: center;">
                <div style="font-size: 10px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 100px;">AI</div>
              </div>
            </div>
            
            <div style="background: #1c1c1c; border-radius: 12px 12px 4px 12px; padding: 12px 14px; max-width: 85%; align-self: flex-end;">
              <div style="font-size: 12px; color: #999; line-height: 1.5;">Check your spam folder! Password emails sometimes land there.</div>
            </div>
            
            <div style="background: rgba(106, 76, 245, 0.2); border-radius: 12px 12px 12px 4px; padding: 12px 14px; max-width: 90%;">
              <div style="font-size: 12px; color: #ccc; line-height: 1.5;">Password reset emails are sent within 5 minutes. Also check your spam folder. You can also use our <span style="color: #0099ff;">Magic Link login</span> as an alternative.</div>
              <div style="margin-top: 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <div style="font-size: 10px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 100px;">AI</div>
                <div style="font-size: 10px; color: #6a4cf5; background: rgba(106,76,245,0.2); padding: 2px 6px; border-radius: 100px; border: 1px solid rgba(106,76,245,0.3);">📄 Account Guide</div>
              </div>
            </div>
            
            <!-- Typing indicator -->
            <div style="display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: rgba(106, 76, 245, 0.1); border-radius: 100px; width: fit-content;">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
          
          <!-- Input -->
          <div style="display: flex; gap: 8px; align-items: center; background: #1c1c1c; border: 1px solid #262626; border-radius: 12px; padding: 10px 14px;">
            <input type="text" placeholder="Ask anything..." style="flex: 1; background: none; border: none; color: #fff; font-size: 13px; outline: none;" />
            <button style="background: linear-gradient(135deg, #6a4cf5, #d44df0); border: none; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-paper-plane" style="color: white; font-size: 11px;"></i>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Floating stats badges -->
      <div style="position: absolute; top: -16px; right: -16px; background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 10px 14px; animation: slideIn 0.8s ease forwards 0.5s; opacity: 0;">
        <div style="font-size: 11px; color: #999; margin-bottom: 2px;">AI Resolution Rate</div>
        <div style="font-size: 20px; font-weight: 700; color: #22c55e;">78.4%</div>
      </div>
      
      <div style="position: absolute; bottom: -16px; left: -16px; background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 10px 14px; animation: slideIn 0.8s ease forwards 0.8s; opacity: 0;">
        <div style="font-size: 11px; color: #999; margin-bottom: 2px;">Avg Response Time</div>
        <div style="font-size: 20px; font-weight: 700; color: #ffffff;">1.2s</div>
      </div>
    </div>
  </div>
</section>

<!-- ============ LOGOS BAR ============ -->
<section style="padding: 32px 24px; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;">
  <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
    <p style="font-size: 13px; color: #555; margin-bottom: 24px; letter-spacing: 1px; text-transform: uppercase;">Trusted by fast-growing companies</p>
    <div style="display: flex; gap: 48px; align-items: center; justify-content: center; flex-wrap: wrap; opacity: 0.4;">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">Acme Corp</span>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">TechFlow</span>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">DevScale</span>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">Nexus</span>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">Orbits</span>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">Prismatic</span>
    </div>
  </div>
</section>

<!-- ============ FEATURES SECTION ============ -->
<section id="features" style="padding: 96px 24px;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 64px;">
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,153,255,0.1); border: 1px solid rgba(0,153,255,0.2); border-radius: 100px; padding: 6px 14px; margin-bottom: 20px;">
        <i class="fas fa-sparkles" style="color: #0099ff; font-size: 12px;"></i>
        <span style="font-size: 13px; color: #0099ff;">Enterprise-Grade Features</span>
      </div>
      <h2 class="display-lg" style="margin-bottom: 16px;">Everything you need to<br>deliver exceptional support</h2>
      <p style="font-size: 18px; color: #999; max-width: 560px; margin: 0 auto; line-height: 1.6;">From AI-powered responses to human agent handoffs — SupportIQ handles the entire support lifecycle.</p>
    </div>
    
    <div class="grid-features">
      <!-- Feature 1: RAG Knowledge Base -->
      <div class="gradient-violet-card" style="padding: 32px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
        <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-brain" style="color: white; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">RAG Knowledge Base</h3>
        <p style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.6;">Upload PDFs, DOCX, or paste FAQs. Auto-chunked, embedded, and semantically searchable. Answers grounded in your docs only.</p>
        <div style="margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 100px; font-size: 11px;">PDF</span>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 100px; font-size: 11px;">DOCX</span>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 100px; font-size: 11px;">Text</span>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 100px; font-size: 11px;">Auto-index</span>
        </div>
      </div>
      
      <!-- Feature 2: AI Chat -->
      <div class="card" style="padding: 32px;">
        <div style="width: 44px; height: 44px; background: rgba(0,153,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-comments" style="color: #0099ff; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">Embeddable AI Widget</h3>
        <p style="font-size: 14px; color: #999; line-height: 1.6;">One-line embed script for any website. Branded chat experience with AI typing indicators, source citations, and session history.</p>
        <div style="margin-top: 20px; background: #0d0d0d; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #6a4cf5;">
          &lt;script src="supportiq.io/widget.js" <br>&nbsp;&nbsp;data-key="YOUR_KEY"&gt;<br>&lt;/script&gt;
        </div>
      </div>
      
      <!-- Feature 3: Ticket Management -->
      <div class="card" style="padding: 32px;">
        <div style="width: 44px; height: 44px; background: rgba(255, 122, 61, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-ticket" style="color: #ff7a3d; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">Smart Ticket System</h3>
        <p style="font-size: 14px; color: #999; line-height: 1.6;">Auto-create tickets on escalation. Priority routing, SLA tracking, round-robin assignment, and canned responses for your agents.</p>
        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #999;">SLA Compliance</span>
            <span style="font-size: 13px; color: #22c55e; font-weight: 600;">94.2%</span>
          </div>
          <div style="height: 4px; background: #1a1a1a; border-radius: 2px;">
            <div style="height: 100%; width: 94%; background: linear-gradient(90deg, #22c55e, #6a4cf5); border-radius: 2px;"></div>
          </div>
        </div>
      </div>
      
      <!-- Feature 4: Analytics -->
      <div class="gradient-magenta-card" style="padding: 32px; position: relative; overflow: hidden;">
        <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
        <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-chart-line" style="color: white; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">AI Performance Analytics</h3>
        <p style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.6;">Track AI resolution rates, identify knowledge gaps, CSAT scores, agent performance, and ticket volume trends.</p>
        <div style="margin-top: 20px; display: flex; gap: 16px;">
          <div><div style="font-size: 22px; font-weight: 700;">78%</div><div style="font-size: 11px; color: rgba(255,255,255,0.6);">AI resolved</div></div>
          <div><div style="font-size: 22px; font-weight: 700;">4.8★</div><div style="font-size: 11px; color: rgba(255,255,255,0.6);">CSAT</div></div>
          <div><div style="font-size: 22px; font-weight: 700;">1.2s</div><div style="font-size: 11px; color: rgba(255,255,255,0.6);">Avg response</div></div>
        </div>
      </div>
      
      <!-- Feature 5: Multi-tenant -->
      <div class="card" style="padding: 32px;">
        <div style="width: 44px; height: 44px; background: rgba(212, 77, 240, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-shield-halved" style="color: #d44df0; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">Multi-Tenant Security</h3>
        <p style="font-size: 14px; color: #999; line-height: 1.6;">Complete data isolation per workspace. RBAC with Admin/Agent/Customer roles. SOC2-ready architecture with audit logs.</p>
        <div style="margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); padding: 4px 10px; border-radius: 100px; font-size: 11px;">● RBAC</span>
          <span style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); padding: 4px 10px; border-radius: 100px; font-size: 11px;">● Isolated</span>
          <span style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); padding: 4px 10px; border-radius: 100px; font-size: 11px;">● Audit</span>
        </div>
      </div>
      
      <!-- Feature 6: Escalation -->
      <div class="card" style="padding: 32px;">
        <div style="width: 44px; height: 44px; background: rgba(255, 85, 119, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <i class="fas fa-arrow-up-right-from-square" style="color: #ff5577; font-size: 18px;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">Smart Escalation Logic</h3>
        <p style="font-size: 14px; color: #999; line-height: 1.6;">Confidence-based auto-escalation, keyword triggers ("refund", "cancel"), and one-click customer-initiated handoff to human agents.</p>
        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999;">
            <i class="fas fa-check" style="color: #22c55e;"></i> Low confidence → auto-escalate
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999;">
            <i class="fas fa-check" style="color: #22c55e;"></i> Keyword triggers
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999;">
            <i class="fas fa-check" style="color: #22c55e;"></i> Customer-initiated handoff
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ HOW IT WORKS ============ -->
<section style="padding: 96px 24px; background: #0d0d0d;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 64px;">
      <h2 class="display-lg" style="margin-bottom: 16px;">Up and running in<br><span class="gradient-text-violet">minutes, not months</span></h2>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;" class="grid-2">
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px; font-weight: 700;">1</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Create Workspace</h3>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">Sign up, create your workspace, invite team members</p>
      </div>
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #d44df0, #ff5577); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px; font-weight: 700;">2</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Upload Knowledge</h3>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">Upload your docs, FAQs, and guides. AI auto-indexes everything</p>
      </div>
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #ff7a3d, #ff5577); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px; font-weight: 700;">3</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Embed Widget</h3>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">One script tag on your website. Fully branded and customizable</p>
      </div>
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #0099ff, #6a4cf5); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px; font-weight: 700;">4</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Watch AI Work</h3>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">AI resolves 80% of tickets. You focus on the complex ones</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ PRICING SECTION ============ -->
<section id="pricing" style="padding: 96px 24px;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 48px;">
      <h2 class="display-lg" style="margin-bottom: 16px;">Simple, transparent pricing</h2>
      <p style="font-size: 18px; color: #999;">Start free, scale as you grow</p>
    </div>
    
    <!-- Billing toggle -->
    <div style="display: flex; justify-content: center; margin-bottom: 48px;">
      <div style="background: #141414; border: 1px solid #262626; border-radius: 100px; padding: 4px; display: flex; gap: 4px;">
        <button id="monthly-btn" onclick="setBilling('monthly')" style="background: #ffffff; color: #000; border: none; border-radius: 100px; padding: 8px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;">Monthly</button>
        <button id="yearly-btn" onclick="setBilling('yearly')" style="background: transparent; color: #999; border: none; border-radius: 100px; padding: 8px 20px; font-size: 14px; cursor: pointer; transition: all 0.2s;">Yearly <span style="color: #22c55e; font-size: 12px;">-20%</span></button>
      </div>
    </div>
    
    <div class="grid-pricing">
      <!-- Starter -->
      <div class="card" style="padding: 32px;">
        <div style="margin-bottom: 24px;">
          <div style="font-size: 14px; color: #999; margin-bottom: 8px;">Starter</div>
          <div style="display: flex; align-items: baseline; gap: 4px;">
            <span style="font-size: 42px; font-weight: 700; letter-spacing: -2px;" id="starter-price">$49</span>
            <span style="color: #666;">/mo</span>
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">Up to 3 agents</div>
        </div>
        <div style="height: 1px; background: #1a1a1a; margin-bottom: 24px;"></div>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> 1 Knowledge Base</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> 500 AI conversations/mo</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Basic analytics</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Email support</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #555;"><i class="fas fa-times" style="color: #555; width: 16px;"></i> Custom branding</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #555;"><i class="fas fa-times" style="color: #555; width: 16px;"></i> API access</div>
        </div>
        <a href="/signup" class="btn-secondary" style="width: 100%; justify-content: center;">Get Started</a>
      </div>
      
      <!-- Pro (Featured) -->
      <div class="card-elevated" style="padding: 32px; border: 1px solid rgba(106, 76, 245, 0.4); position: relative;">
        <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #6a4cf5, #d44df0); padding: 4px 16px; border-radius: 100px; font-size: 12px; font-weight: 600; white-space: nowrap;">Most Popular</div>
        <div style="margin-bottom: 24px;">
          <div style="font-size: 14px; color: #999; margin-bottom: 8px;">Pro</div>
          <div style="display: flex; align-items: baseline; gap: 4px;">
            <span style="font-size: 42px; font-weight: 700; letter-spacing: -2px;" id="pro-price">$149</span>
            <span style="color: #666;">/mo</span>
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">Up to 15 agents</div>
        </div>
        <div style="height: 1px; background: #262626; margin-bottom: 24px;"></div>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> 5 Knowledge Bases</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> 5,000 AI conversations/mo</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Advanced analytics</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Custom branding</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> API access + Webhooks</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #fff;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Priority support</div>
        </div>
        <a href="/signup" class="btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #6a4cf5, #d44df0); color: white;">Start Pro Trial</a>
      </div>
      
      <!-- Enterprise -->
      <div class="card" style="padding: 32px;">
        <div style="margin-bottom: 24px;">
          <div style="font-size: 14px; color: #999; margin-bottom: 8px;">Enterprise</div>
          <div style="display: flex; align-items: baseline; gap: 4px;">
            <span style="font-size: 42px; font-weight: 700; letter-spacing: -2px;">Custom</span>
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">Unlimited agents</div>
        </div>
        <div style="height: 1px; background: #1a1a1a; margin-bottom: 24px;"></div>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Unlimited Knowledge Bases</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Unlimited AI conversations</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Custom AI model fine-tuning</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> SSO/SAML</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> Dedicated infrastructure</div>
          <div style="display: flex; gap: 10px; align-items: center; font-size: 14px; color: #999;"><i class="fas fa-check" style="color: #22c55e; width: 16px;"></i> 24/7 dedicated support</div>
        </div>
        <a href="mailto:sales@supportiq.io" class="btn-secondary" style="width: 100%; justify-content: center;">Contact Sales</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ CTA BANNER ============ -->
<section style="padding: 96px 24px;">
  <div style="max-width: 1000px; margin: 0 auto;">
    <div class="gradient-violet-card" style="padding: 64px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
      <div style="position: absolute; bottom: -40px; left: -40px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
      <h2 class="display-md" style="margin-bottom: 16px; font-size: 42px; letter-spacing: -2px;">Ready to transform<br>your support?</h2>
      <p style="font-size: 18px; color: rgba(255,255,255,0.7); margin-bottom: 32px;">14-day free trial. No credit card required. Setup in under 5 minutes.</p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="/signup" class="btn-primary" style="padding: 14px 32px; font-size: 15px;">Start Free Trial <i class="fas fa-arrow-right"></i></a>
        <a href="#" class="btn-secondary" style="padding: 14px 32px; font-size: 15px; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2);">Book a Demo</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ FOOTER ============ -->
<footer style="border-top: 1px solid #1a1a1a; padding: 64px 24px 32px;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 48px;" class="grid-2">
      <div>
        <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 16px;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-bolt" style="color: white; font-size: 13px;"></i>
          </div>
          <span style="font-size: 16px; font-weight: 600; color: #fff;">SupportIQ</span>
        </a>
        <p style="font-size: 13px; color: #555; line-height: 1.6; max-width: 240px;">AI-powered customer support platform for modern SaaS companies.</p>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <a href="#" style="color: #555; font-size: 16px; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'"><i class="fab fa-twitter"></i></a>
          <a href="#" style="color: #555; font-size: 16px; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'"><i class="fab fa-github"></i></a>
          <a href="#" style="color: #555; font-size: 16px; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'"><i class="fab fa-linkedin"></i></a>
        </div>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Product</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#features" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Features</a>
          <a href="#pricing" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Pricing</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Changelog</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Roadmap</a>
        </div>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Developers</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">API Docs</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Widget SDK</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Webhooks</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Status</a>
        </div>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Company</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">About</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Blog</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Careers</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Contact</a>
        </div>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Legal</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Privacy</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Terms</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Security</a>
          <a href="#" style="font-size: 13px; color: #555; text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">GDPR</a>
        </div>
      </div>
    </div>
    
    <div style="height: 1px; background: #1a1a1a; margin-bottom: 24px;"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div style="font-size: 13px; color: #555;">© 2024 SupportIQ, Inc. All rights reserved.</div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <div style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%;"></div>
        <span style="font-size: 13px; color: #555;">All systems operational</span>
      </div>
    </div>
  </div>
</footer>

<script>
  let billingMode = 'monthly';
  
  function setBilling(mode) {
    billingMode = mode;
    const prices = {
      monthly: { starter: '$49', pro: '$149' },
      yearly: { starter: '$39', pro: '$119' }
    };
    document.getElementById('starter-price').textContent = prices[mode].starter;
    document.getElementById('pro-price').textContent = prices[mode].pro;
    
    const monthlyBtn = document.getElementById('monthly-btn');
    const yearlyBtn = document.getElementById('yearly-btn');
    
    if (mode === 'monthly') {
      monthlyBtn.style.background = '#ffffff';
      monthlyBtn.style.color = '#000';
      yearlyBtn.style.background = 'transparent';
      yearlyBtn.style.color = '#999';
    } else {
      yearlyBtn.style.background = '#ffffff';
      yearlyBtn.style.color = '#000';
      monthlyBtn.style.background = 'transparent';
      monthlyBtn.style.color = '#999';
    }
  }
  
  function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('open');
  }
  
  // Show floating badges with animation
  setTimeout(() => {
    document.querySelectorAll('[style*="opacity: 0"]').forEach(el => {
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      el.style.opacity = '1';
    });
  }, 1000);
  
  // Show hamburger on mobile
  function checkMobile() {
    const hamburger = document.getElementById('hamburger');
    if (window.innerWidth <= 810) {
      hamburger.style.display = 'flex';
    } else {
      hamburger.style.display = 'none';
      document.getElementById('mobile-menu').classList.remove('open');
    }
  }
  window.addEventListener('resize', checkMobile);
  checkMobile();
  
  // Intersection observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
</script>
</body>
</html>`
}

// Route handlers for all pages
app.get('/', (c) => c.html(getLandingHTML()))
app.get('/login', (c) => c.html(getLoginHTML()))
app.get('/signup', (c) => c.html(getSignupHTML()))
app.get('/dashboard', (c) => c.html(getDashboardHTML('overview')))
app.get('/dashboard/inbox', (c) => c.html(getDashboardHTML('inbox')))
app.get('/dashboard/tickets', (c) => c.html(getDashboardHTML('tickets')))
app.get('/dashboard/knowledge-base', (c) => c.html(getDashboardHTML('knowledge-base')))
app.get('/dashboard/analytics', (c) => c.html(getDashboardHTML('analytics')))
app.get('/dashboard/settings', (c) => c.html(getDashboardHTML('settings')))
app.get('/pricing', (c) => c.redirect('/#pricing'))
app.get('/widget', (c) => c.html(getWidgetDemoHTML()))

function getAuthStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #090909; color: #fff; font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .auth-card { background: #141414; border: 1px solid #1a1a1a; border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; }
    .input-field { width: 100%; background: #0d0d0d; border: 1px solid #262626; border-radius: 10px; padding: 12px 16px; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s; font-family: inherit; }
    .input-field:focus { border-color: rgba(0,153,255,0.4); box-shadow: 0 0 0 3px rgba(0,153,255,0.08); }
    .input-field::placeholder { color: #555; }
    .btn-primary { background: #fff; color: #000; border-radius: 100px; padding: 13px 24px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; width: 100%; transition: all 0.2s; font-family: inherit; }
    .btn-primary:hover { background: #f0f0f0; }
    .btn-google { background: #1c1c1c; color: #fff; border: 1px solid #262626; border-radius: 100px; padding: 13px 24px; font-size: 14px; cursor: pointer; width: 100%; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: inherit; }
    .btn-google:hover { background: #262626; }
    label { display: block; font-size: 13px; color: #999; margin-bottom: 6px; }
    a { color: #0099ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  `
}

function getLoginHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — SupportIQ</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>${getAuthStyles()}</style>
</head>
<body>
  <div style="width: 100%; max-width: 420px; padding: 24px;">
    <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 32px; justify-content: center;">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <i class="fas fa-bolt" style="color: white; font-size: 14px;"></i>
      </div>
      <span style="font-size: 18px; font-weight: 600; color: #fff;">SupportIQ</span>
    </a>
    
    <div class="auth-card">
      <h1 style="font-size: 24px; font-weight: 600; letter-spacing: -0.8px; margin-bottom: 8px;">Welcome back</h1>
      <p style="font-size: 14px; color: #666; margin-bottom: 28px;">Sign in to your workspace</p>
      
      <button class="btn-google" onclick="handleLogin()" style="margin-bottom: 20px;">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; height: 1px; background: #1a1a1a;"></div>
        <span style="font-size: 12px; color: #555;">or</span>
        <div style="flex: 1; height: 1px; background: #1a1a1a;"></div>
      </div>
      
      <div id="error-msg" style="display:none; background: rgba(255,85,119,0.1); border: 1px solid rgba(255,85,119,0.3); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #ff5577; margin-bottom: 16px;"></div>

      <form id="login-form" onsubmit="handleLogin(event)" style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label>Email address</label>
          <input id="login-email" type="email" class="input-field" placeholder="you@company.com" required>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="margin: 0;">Password</label>
            <a href="#" style="font-size: 12px;">Forgot password?</a>
          </div>
          <input id="login-password" type="password" class="input-field" placeholder="••••••••" required>
        </div>
        <button type="submit" id="login-btn" class="btn-primary">Sign In</button>
      </form>
      
      <p style="text-align: center; font-size: 13px; color: #666; margin-top: 20px;">
        Don't have an account? <a href="/signup">Sign up free</a>
      </p>
    </div>
  </div>
  
  <script>
    // Redirect if already logged in
    if (localStorage.getItem('siq_token')) window.location.href = '/dashboard';

    async function handleLogin(e) {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const errEl = document.getElementById('error-msg');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      btn.textContent = 'Signing in...';
      btn.disabled = true;
      errEl.style.display = 'none';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        localStorage.setItem('siq_token', data.token);
        localStorage.setItem('siq_user', JSON.stringify(data.user));
        localStorage.setItem('siq_tenant', JSON.stringify(data.tenant));
        window.location.href = '/dashboard';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`
}

function getSignupHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up — SupportIQ</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>${getAuthStyles()}</style>
</head>
<body>
  <div style="width: 100%; max-width: 420px; padding: 24px;">
    <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 32px; justify-content: center;">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <i class="fas fa-bolt" style="color: white; font-size: 14px;"></i>
      </div>
      <span style="font-size: 18px; font-weight: 600; color: #fff;">SupportIQ</span>
    </a>
    
    <div class="auth-card">
      <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); border-radius: 100px; padding: 4px 12px; margin-bottom: 20px;">
        <i class="fas fa-gift" style="color: #22c55e; font-size: 11px;"></i>
        <span style="font-size: 12px; color: #22c55e;">14-day free trial, no card required</span>
      </div>
      
      <h1 style="font-size: 24px; font-weight: 600; letter-spacing: -0.8px; margin-bottom: 8px;">Create your workspace</h1>
      <p style="font-size: 14px; color: #666; margin-bottom: 28px;">Get your AI support agent live in minutes</p>
      
      <div id="signup-error" style="display:none; background: rgba(255,85,119,0.1); border: 1px solid rgba(255,85,119,0.3); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #ff5577; margin-bottom: 16px;"></div>

      <form id="signup-form" onsubmit="handleSignup(event)" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label>First name</label>
            <input id="su-first" type="text" class="input-field" placeholder="Alex" required>
          </div>
          <div>
            <label>Last name</label>
            <input id="su-last" type="text" class="input-field" placeholder="Morgan" required>
          </div>
        </div>
        <div>
          <label>Work email</label>
          <input id="su-email" type="email" class="input-field" placeholder="you@company.com" required>
        </div>
        <div>
          <label>Company name</label>
          <input id="su-company" type="text" class="input-field" placeholder="Acme Corp" required>
        </div>
        <div>
          <label>Password</label>
          <input id="su-password" type="password" class="input-field" placeholder="Min. 8 characters" required minlength="8">
        </div>
        <button type="submit" id="signup-btn" class="btn-primary" style="margin-top: 4px;">
          Create Free Account <i class="fas fa-arrow-right" style="margin-left: 8px;"></i>
        </button>
      </form>
      
      <p style="font-size: 12px; color: #444; text-align: center; margin-top: 16px; line-height: 1.5;">
        By signing up, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
      </p>
      
      <p style="text-align: center; font-size: 13px; color: #666; margin-top: 16px;">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </div>
  </div>
  
  <script>
    if (localStorage.getItem('siq_token')) window.location.href = '/dashboard';

    async function handleSignup(e) {
      e.preventDefault();
      const btn = document.getElementById('signup-btn');
      const errEl = document.getElementById('signup-error');
      btn.textContent = 'Creating workspace...';
      btn.disabled = true;
      errEl.style.display = 'none';

      const payload = {
        first_name: document.getElementById('su-first').value.trim(),
        last_name: document.getElementById('su-last').value.trim(),
        email: document.getElementById('su-email').value.trim(),
        company_name: document.getElementById('su-company').value.trim(),
        password: document.getElementById('su-password').value,
      };

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        localStorage.setItem('siq_token', data.token);
        localStorage.setItem('siq_user', JSON.stringify(data.user));
        localStorage.setItem('siq_tenant', JSON.stringify(data.tenant));
        window.location.href = '/dashboard';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.innerHTML = 'Create Free Account <i class="fas fa-arrow-right" style="margin-left: 8px;"></i>';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`
}

function getDashboardHTML(section: string): string {
  const sections: Record<string, string> = {
    'overview': getDashboardOverview(),
    'inbox': getInboxContent(),
    'tickets': getTicketsContent(),
    'knowledge-base': getKnowledgeBaseContent(),
    'analytics': getAnalyticsContent(),
    'settings': getSettingsContent(),
  }
  
  const content = sections[section] || sections['overview']
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — SupportIQ</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #090909; color: #fff; font-family: 'Inter', system-ui, sans-serif; display: flex; min-height: 100vh; -webkit-font-smoothing: antialiased; }
    
    /* Sidebar */
    .sidebar { width: 220px; min-height: 100vh; background: #090909; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; transition: transform 0.3s; }
    .sidebar-logo { padding: 20px; border-bottom: 1px solid #1a1a1a; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #666; font-size: 13px; text-decoration: none; border-radius: 8px; margin: 2px 8px; transition: all 0.15s; cursor: pointer; }
    .nav-item:hover { background: #141414; color: #fff; }
    .nav-item.active { background: #141414; color: #fff; }
    .nav-item .icon { width: 18px; text-align: center; font-size: 14px; }
    .nav-badge { background: #d44df0; color: #fff; border-radius: 100px; padding: 1px 7px; font-size: 11px; font-weight: 600; margin-left: auto; }
    
    /* Main */
    .main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
    .topbar { height: 56px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; padding: 0 24px; gap: 16px; position: sticky; top: 0; background: rgba(9,9,9,0.95); backdrop-filter: blur(8px); z-index: 40; }
    .content { padding: 28px; flex: 1; }
    
    /* Cards */
    .card { background: #141414; border: 1px solid #1a1a1a; border-radius: 16px; }
    .card-elevated { background: #1c1c1c; border: 1px solid #262626; border-radius: 16px; }
    .stat-card { padding: 20px 24px; }
    
    /* Inputs */
    .input-field { background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 9px 14px; color: #fff; font-size: 13px; outline: none; font-family: inherit; transition: border-color 0.2s; }
    .input-field:focus { border-color: rgba(0,153,255,0.4); }
    .input-field::placeholder { color: #555; }
    
    /* Badges */
    .badge { padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 500; }
    .badge-open { background: rgba(0,153,255,0.15); color: #0099ff; }
    .badge-progress { background: rgba(255,122,61,0.15); color: #ff7a3d; }
    .badge-resolved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .badge-urgent { background: rgba(255,85,119,0.15); color: #ff5577; }
    .badge-high { background: rgba(255,122,61,0.15); color: #ff7a3d; }
    .badge-medium { background: rgba(106,76,245,0.15); color: #6a4cf5; }
    .badge-low { background: rgba(153,153,153,0.15); color: #999; }
    
    /* Buttons */
    .btn-primary { background: #fff; color: #000; border-radius: 100px; padding: 8px 18px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary:hover { background: #f0f0f0; }
    .btn-secondary { background: #1c1c1c; color: #fff; border-radius: 100px; padding: 8px 18px; font-size: 13px; font-weight: 500; border: 1px solid #262626; cursor: pointer; font-family: inherit; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-secondary:hover { background: #262626; }
    
    /* Ticket rows */
    .ticket-row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #1a1a1a; transition: background 0.15s; cursor: pointer; }
    .ticket-row:hover { background: #141414; }
    .ticket-row:last-child { border-bottom: none; }
    
    /* Chat */
    .msg-ai { background: rgba(106,76,245,0.12); border-radius: 12px 12px 12px 4px; padding: 12px 14px; max-width: 80%; }
    .msg-customer { background: #1c1c1c; border-radius: 12px 12px 4px 12px; padding: 12px 14px; max-width: 80%; align-self: flex-end; }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #090909; }
    ::-webkit-scrollbar-thumb { background: #262626; border-radius: 2px; }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); }
      .main { margin-left: 0; }
      .content { padding: 16px; }
    }
    
    /* Typing animation */
    @keyframes typing { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
    .typing-dot { width: 5px; height: 5px; border-radius: 50%; background: #666; display: inline-block; animation: typing 1.4s infinite ease-in-out; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  </style>
</head>
<body>

<!-- Sidebar -->
<nav class="sidebar" id="sidebar">
  <div class="sidebar-logo">
    <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none;">
      <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 7px; display: flex; align-items: center; justify-content: center;">
        <i class="fas fa-bolt" style="color: white; font-size: 12px;"></i>
      </div>
      <span style="font-size: 15px; font-weight: 600;">SupportIQ</span>
    </a>
  </div>
  
  <!-- Workspace selector -->
  <div style="padding: 12px 16px; border-bottom: 1px solid #1a1a1a;">
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #141414; border: 1px solid #1a1a1a; border-radius: 8px; cursor: pointer;">
      <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #0099ff, #6a4cf5); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700;" id="ws-initials">--</div>
      <span style="font-size: 12px; font-weight: 500; flex: 1;" id="ws-name">Workspace</span>
      <i class="fas fa-chevron-down" style="font-size: 10px; color: #666;"></i>
    </div>
  </div>
  
  <!-- Nav -->
  <div style="padding: 12px 0; flex: 1;">
    <div style="padding: 4px 16px 8px; font-size: 11px; color: #444; text-transform: uppercase; letter-spacing: 0.5px;">Menu</div>
    
    <a href="/dashboard" class="nav-item ${section === 'overview' ? 'active' : ''}">
      <i class="fas fa-grid-2 icon"></i> Overview
    </a>
    <a href="/dashboard/inbox" class="nav-item ${section === 'inbox' ? 'active' : ''}">
      <i class="fas fa-inbox icon"></i> Inbox
      <span class="nav-badge">12</span>
    </a>
    <a href="/dashboard/tickets" class="nav-item ${section === 'tickets' ? 'active' : ''}">
      <i class="fas fa-ticket icon"></i> Tickets
    </a>
    <a href="/dashboard/knowledge-base" class="nav-item ${section === 'knowledge-base' ? 'active' : ''}">
      <i class="fas fa-book icon"></i> Knowledge Base
    </a>
    <a href="/dashboard/analytics" class="nav-item ${section === 'analytics' ? 'active' : ''}">
      <i class="fas fa-chart-line icon"></i> Analytics
    </a>
    
    <div style="padding: 16px 16px 8px; font-size: 11px; color: #444; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">Admin</div>
    <a href="#" class="nav-item">
      <i class="fas fa-users icon"></i> Team
    </a>
    <a href="/dashboard/settings" class="nav-item ${section === 'settings' ? 'active' : ''}">
      <i class="fas fa-gear icon"></i> Settings
    </a>
  </div>
  
  <!-- User -->
  <div style="padding: 16px; border-top: 1px solid #1a1a1a;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div id="user-avatar" style="width: 32px; height: 32px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">--</div>
      <div style="min-width: 0;">
        <div id="user-name" style="font-size: 13px; font-weight: 500; truncate;">Loading...</div>
        <div id="user-role" style="font-size: 11px; color: #666;">--</div>
      </div>
      <button onclick="handleLogout()" style="margin-left: auto; background: none; border: none; color: #555; font-size: 13px; cursor: pointer;" title="Sign out"><i class="fas fa-sign-out-alt"></i></button>
    </div>
  </div>
</nav>

<!-- Main content -->
<div class="main">
  <!-- Topbar -->
  <header class="topbar">
    <button onclick="toggleSidebar()" style="background: none; border: none; color: #666; font-size: 16px; cursor: pointer; display: none;" id="mobile-toggle"><i class="fas fa-bars"></i></button>
    <div style="flex: 1; max-width: 360px;">
      <div style="position: relative;">
        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #555; font-size: 13px;"></i>
        <input type="text" class="input-field" placeholder="Search tickets, conversations..." style="width: 100%; padding-left: 36px;">
      </div>
    </div>
    <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
      <button style="background: none; border: none; color: #666; font-size: 16px; cursor: pointer; position: relative;" title="Notifications">
        <i class="fas fa-bell"></i>
        <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #d44df0; border-radius: 50%; border: 2px solid #090909;"></div>
      </button>
      <a href="/widget" class="btn-secondary" style="padding: 7px 14px; font-size: 12px; text-decoration: none;"><i class="fas fa-external-link-alt"></i> Widget Demo</a>
    </div>
  </header>
  
  <!-- Content -->
  <div class="content">
    ${content}
  </div>
</div>

<script>
  // ---- Auth guard -----------------------------------------
  const siqToken = localStorage.getItem('siq_token');
  const siqUser  = JSON.parse(localStorage.getItem('siq_user') || 'null');
  const siqTenant = JSON.parse(localStorage.getItem('siq_tenant') || 'null');

  if (!siqToken) { window.location.href = '/login'; }

  // ---- Populate user info ---------------------------------
  if (siqUser) {
    const initials = ((siqUser.first_name||'')[0]||('')+((siqUser.last_name||'')[0]||'')).toUpperCase();
    const el = document.getElementById('user-avatar');
    if (el) el.textContent = initials || '--';
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = (siqUser.first_name + ' ' + siqUser.last_name).trim() || siqUser.email;
    const roleEl = document.getElementById('user-role');
    if (roleEl) roleEl.textContent = siqUser.role || 'agent';
  }
  if (siqTenant) {
    const wsName = document.getElementById('ws-name');
    if (wsName) wsName.textContent = siqTenant.name || 'Workspace';
    const wsInit = document.getElementById('ws-initials');
    if (wsInit) wsInit.textContent = (siqTenant.name||'WS').slice(0,2).toUpperCase();
  }

  function handleLogout() {
    localStorage.removeItem('siq_token');
    localStorage.removeItem('siq_user');
    localStorage.removeItem('siq_tenant');
    window.location.href = '/';
  }

  function authFetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: { 'Authorization': 'Bearer ' + siqToken, 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }
  
  // Show mobile toggle on small screens
  function checkMobile() {
    const toggle = document.getElementById('mobile-toggle');
    if (window.innerWidth <= 768) {
      toggle.style.display = 'block';
    } else {
      toggle.style.display = 'none';
      document.getElementById('sidebar').classList.remove('open');
    }
  }
  window.addEventListener('resize', checkMobile);
  checkMobile();
  
  // Render charts if chart elements exist
  if (document.getElementById('volumeChart')) {
    // Fetch real stats then draw chart
    authFetch('/api/stats').then(r => r.json()).then(data => {
      const ctx = document.getElementById('volumeChart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          datasets: [{
            label: 'Tickets',
            data: data.ticketVolume || [0,0,0,0,0,0,0,0,0,0,0,0],
            borderColor: '#6a4cf5',
            backgroundColor: 'rgba(106,76,245,0.1)',
            borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6a4cf5',
          pointRadius: 4,
          pointHoverRadius: 6,
        }, {
          label: 'AI Resolved',
          data: [33, 45, 28, 55, 50, 38, 43, 52, 56, 48, 42, 38],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.05)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#22c55e',
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#666', font: { family: 'Inter', size: 12 }, boxWidth: 12 } } },
        scales: {
          x: { grid: { color: '#1a1a1a' }, ticks: { color: '#555', font: { family: 'Inter', size: 11 } } },
          y: { grid: { color: '#1a1a1a' }, ticks: { color: '#555', font: { family: 'Inter', size: 11 } } }
        }
      }
    });
    }).catch(() => {});
  }
  
  if (document.getElementById('aiChart')) {
    authFetch('/api/stats').then(r => r.json()).then(data => {
      const bd = data.resolutionBreakdown || {};
      const ctx = document.getElementById('aiChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['AI Resolved', 'Escalated', 'Pending'],
          datasets: [{
            data: [bd.resolved || 0, bd.escalated || 0, bd.pending || 0],
            backgroundColor: ['#22c55e', '#ff7a3d', '#6a4cf5'],
            borderWidth: 0,
            hoverOffset: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { position: 'bottom', labels: { color: '#666', font: { family: 'Inter', size: 12 }, boxWidth: 10, padding: 16 } } }
        }
      });
    }).catch(() => {});
  }
</script>
</body>
</html>`
}

function getDashboardOverview(): string {
  return `
  <div style="margin-bottom: 28px; display:flex; justify-content:space-between; align-items:center;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Overview</h1>
      <p style="font-size: 14px; color: #666;" id="welcome-msg">Welcome back! Here's what's happening today.</p>
    </div>
    <div id="ai-status-badge" style="display:flex; align-items:center; gap:6px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); border-radius:100px; padding:6px 14px; font-size:12px; color:#22c55e;">
      <div style="width:6px; height:6px; background:#22c55e; border-radius:50%;"></div>
      <span id="ai-status-text">Checking AI...</span>
    </div>
  </div>
  
  <!-- Stats (loaded from API) -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;" id="stats-grid">
    ${['fa-ticket #6a4cf5', 'fa-robot #22c55e', 'fa-comments #0099ff', 'fa-check-circle #ff7a3d'].map((icon) => {
      const [ic, col] = icon.split(' ')
      return `<div class="card stat-card">
        <div style="width:36px; height:36px; background:${col}22; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
          <i class="fas ${ic}" style="color:${col}; font-size:14px;"></i>
        </div>
        <div style="font-size:28px; font-weight:700; letter-spacing:-1px; background:#1a1a1a; border-radius:6px; height:36px; animation: shimmer 1.5s infinite; background:linear-gradient(90deg,#1a1a1a 25%,#262626 50%,#1a1a1a 75%); background-size:200% 100%;"></div>
        <div style="font-size:13px; color:#555; margin-top:8px; background:#1a1a1a; border-radius:4px; height:14px; width:70%;"></div>
      </div>`
    }).join('')}
  </div>
  
  <!-- Charts Row -->
  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div class="card" style="padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 15px; font-weight: 600;">Ticket Volume</h2>
        <span style="font-size:11px; color:#555;">Last 12 months</span>
      </div>
      <div style="height: 200px;"><canvas id="volumeChart"></canvas></div>
    </div>
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Resolution Breakdown</h2>
      <div style="height: 160px;"><canvas id="aiChart"></canvas></div>
    </div>
  </div>
  
  <!-- Recent Tickets (loaded from API) -->
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 16px;">
      <h2 style="font-size: 15px; font-weight: 600;">Recent Tickets</h2>
      <a href="/dashboard/tickets" style="font-size: 13px; color: #0099ff; text-decoration: none;">View all →</a>
    </div>
    <div id="recent-tickets-body">
      <div style="padding:20px; text-align:center; color:#555;"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
  </div>
  
  <script>
    // Update welcome message
    if (siqUser) {
      const name = (siqUser.first_name||siqUser.email||'').split(' ')[0] || 'there';
      document.getElementById('welcome-msg').textContent = 'Welcome back, ' + name + '! Here\\'s what\\'s happening today.';
    }
    
    // Check AI status
    fetch('/api/chat/status').then(r=>r.json()).then(s => {
      const el = document.getElementById('ai-status-text');
      const badge = document.getElementById('ai-status-badge');
      if (s.ai_enabled) {
        el.textContent = 'AI Active (' + s.model + ')';
      } else {
        el.textContent = 'AI Not Configured';
        badge.style.background = 'rgba(255,85,119,0.1)';
        badge.style.borderColor = 'rgba(255,85,119,0.2)';
        badge.style.color = '#ff5577';
        badge.querySelector('div').style.background = '#ff5577';
      }
    }).catch(()=>{});
    
    function timeAgo(d) {
      if (!d) return '';
      const diff = Date.now() - new Date(d).getTime();
      const m = Math.floor(diff/60000);
      if (m < 60) return m + 'm ago';
      const h = Math.floor(m/60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h/24) + 'd ago';
    }
    
    // Load real stats
    authFetch('/api/stats').then(r=>r.json()).then(data => {
      const t = data.tickets || {};
      const bd = data.resolutionBreakdown || {};
      const aiRate = t.total > 0 ? Math.round((bd.resolved||0)/Math.max(t.total,1)*100) : 0;
      
      document.getElementById('stats-grid').innerHTML = \`
        <div class="card stat-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="width:36px; height:36px; background:rgba(106,76,245,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-ticket" style="color:#6a4cf5; font-size:14px;"></i></div>
          </div>
          <div style="font-size:28px; font-weight:700; letter-spacing:-1px;">\${(t.total||0).toLocaleString()}</div>
          <div style="font-size:13px; color:#666; margin-top:2px;">Total Tickets</div>
          <div style="font-size:11px; color:#555; margin-top:6px;">Open: \${t.open||0} · Resolved: \${t.resolved||0}</div>
        </div>
        <div class="card stat-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="width:36px; height:36px; background:rgba(34,197,94,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-robot" style="color:#22c55e; font-size:14px;"></i></div>
          </div>
          <div style="font-size:28px; font-weight:700; letter-spacing:-1px;">\${aiRate}%</div>
          <div style="font-size:13px; color:#666; margin-top:2px;">AI Resolution Rate</div>
          <div style="font-size:11px; color:#555; margin-top:6px;">Escalated: \${bd.escalated||0} · Pending: \${bd.pending||0}</div>
        </div>
        <div class="card stat-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="width:36px; height:36px; background:rgba(0,153,255,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-comments" style="color:#0099ff; font-size:14px;"></i></div>
          </div>
          <div style="font-size:28px; font-weight:700; letter-spacing:-1px;">\${(data.conversations?.open||0).toLocaleString()}</div>
          <div style="font-size:13px; color:#666; margin-top:2px;">Open Conversations</div>
        </div>
        <div class="card stat-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="width:36px; height:36px; background:rgba(255,122,61,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-check-circle" style="color:#ff7a3d; font-size:14px;"></i></div>
          </div>
          <div style="font-size:28px; font-weight:700; letter-spacing:-1px;">\${t.in_progress||0}</div>
          <div style="font-size:13px; color:#666; margin-top:2px;">In Progress</div>
        </div>\`;
    }).catch(()=>{});
    
    // Load recent tickets
    authFetch('/api/tickets?limit=5').then(r=>r.json()).then(data => {
      const tickets = data.tickets || [];
      if (!tickets.length) {
        document.getElementById('recent-tickets-body').innerHTML = '<div style="padding:24px; text-align:center; color:#555; font-size:13px;">No tickets yet. <a href="/dashboard/tickets" style="color:#0099ff;">Create your first one →</a></div>';
        return;
      }
      const pBadge = p => ({urgent:'badge-urgent',high:'badge-high',medium:'badge-medium',low:'badge-low'})[p]||'badge-low';
      const sBadge = s => ({open:'badge-open',in_progress:'badge-progress',resolved:'badge-resolved'})[s]||'badge-low';
      const sLabel = s => ({open:'Open',in_progress:'In Progress',resolved:'Resolved',closed:'Closed'})[s]||s;
      document.getElementById('recent-tickets-body').innerHTML = tickets.map(t => \`
        <div class="ticket-row" onclick="window.location.href='/dashboard/tickets'">
          <div style="width:32px; height:32px; background:linear-gradient(135deg,#6a4cf5,#d44df0); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; flex-shrink:0;">\${(t.customer_name||'?').slice(0,2).toUpperCase()}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${t.subject}</div>
            <div style="font-size:12px; color:#666;">\${t.customer_name||t.customer_email||'Unknown'} • \${timeAgo(t.created_at)}</div>
          </div>
          <span class="badge \${pBadge(t.priority)}">\${(t.priority||'').charAt(0).toUpperCase()+(t.priority||'').slice(1)}</span>
          <span class="badge \${sBadge(t.status)}" style="margin-left:8px;">\${sLabel(t.status)}</span>
        </div>\`).join('');
    }).catch(()=>{
      document.getElementById('recent-tickets-body').innerHTML = '<div style="padding:20px; color:#555; font-size:13px; text-align:center;">No tickets data available</div>';
    });
  </script>`
}

function getInboxContent(): string {
  return `
  <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Inbox</h1>
      <p style="font-size: 14px; color: #666;" id="inbox-count">Loading conversations...</p>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn-secondary" onclick="loadConversations()"><i class="fas fa-refresh"></i> Refresh</button>
    </div>
  </div>
  
  <div style="display: grid; grid-template-columns: 320px 1fr; gap: 16px; height: calc(100vh - 180px);">
    <!-- Conversation list -->
    <div class="card" style="overflow-y: auto; display:flex; flex-direction:column;">
      <!-- Tabs -->
      <div style="display: flex; border-bottom: 1px solid #1a1a1a; padding: 4px; flex-shrink:0;">
        <button id="tab-all" onclick="setConvTab('all')" style="flex:1; background:#1c1c1c; border:none; color:#fff; padding:8px; font-size:12px; cursor:pointer; border-radius:6px; font-family:inherit;">All</button>
        <button id="tab-escalated" onclick="setConvTab('escalated')" style="flex:1; background:none; border:none; color:#666; padding:8px; font-size:12px; cursor:pointer; border-radius:6px; font-family:inherit;">Escalated</button>
        <button id="tab-resolved" onclick="setConvTab('resolved')" style="flex:1; background:none; border:none; color:#666; padding:8px; font-size:12px; cursor:pointer; border-radius:6px; font-family:inherit;">Resolved</button>
      </div>
      <div id="conv-list" style="flex:1; overflow-y:auto;">
        <div style="padding:20px; text-align:center; color:#555;"><i class="fas fa-spinner fa-spin"></i></div>
      </div>
    </div>
    
    <!-- Chat panel -->
    <div class="card" style="display: flex; flex-direction: column; overflow: hidden;">
      <!-- Empty state -->
      <div id="chat-empty" style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#555; gap:12px;">
        <i class="fas fa-comments" style="font-size:48px;"></i>
        <div style="font-size:14px;">Select a conversation to view messages</div>
      </div>
      
      <!-- Chat content (hidden until conv selected) -->
      <div id="chat-panel" style="display:none; flex-direction:column; height:100%;">
        <!-- Chat header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 12px; flex-shrink:0;">
          <div id="chat-avatar" style="width:36px; height:36px; background:linear-gradient(135deg, #6a4cf5, #d44df0); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0;">--</div>
          <div>
            <div id="chat-name" style="font-size:14px; font-weight:600;">-</div>
            <div id="chat-meta" style="font-size:12px; color:#666;">-</div>
          </div>
          <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
            <span id="chat-status-badge" class="badge badge-open">Open</span>
            <button onclick="markResolved()" class="btn-primary" style="font-size:12px; padding:7px 14px;"><i class="fas fa-check"></i> Resolve</button>
            <button onclick="getDraftReply()" style="background:rgba(106,76,245,0.15); border:1px solid rgba(106,76,245,0.3); border-radius:100px; color:#6a4cf5; padding:7px 14px; font-size:12px; cursor:pointer;"><i class="fas fa-robot"></i> AI Draft</button>
          </div>
        </div>
        
        <!-- Messages -->
        <div id="chat-messages" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px;">
        </div>
        
        <!-- Reply box -->
        <div style="padding: 16px 20px; border-top: 1px solid #1a1a1a; flex-shrink:0;">
          <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
            <button onclick="insertCanned('I apologize for the inconvenience. Let me check this for you right away.')" style="background:#1c1c1c; border:1px solid #262626; border-radius:100px; padding:4px 12px; font-size:11px; color:#999; cursor:pointer;">👋 Greeting</button>
            <button onclick="insertCanned('I have escalated this to our technical team. You will hear back within 2 hours.')" style="background:#1c1c1c; border:1px solid #262626; border-radius:100px; padding:4px 12px; font-size:11px; color:#999; cursor:pointer;">⬆️ Escalate</button>
            <button onclick="insertCanned('Your issue has been resolved. Please let me know if you need anything else!')" style="background:#1c1c1c; border:1px solid #262626; border-radius:100px; padding:4px 12px; font-size:11px; color:#999; cursor:pointer;">✅ Resolved</button>
          </div>
          <div style="display: flex; gap: 10px; align-items: flex-end;">
            <textarea id="reply-input" placeholder="Type a reply..." style="flex:1; background:#1c1c1c; border:1px solid #262626; border-radius:10px; padding:12px 14px; color:#fff; font-size:13px; outline:none; resize:none; min-height:80px; font-family:inherit;" onfocus="this.style.borderColor='rgba(0,153,255,0.4)'" onblur="this.style.borderColor='#262626'"></textarea>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button onclick="sendReply()" class="btn-primary" style="border-radius:8px; padding:10px 16px;"><i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    let currentConvId = null;
    let currentTabFilter = '';
    
    function timeAgo(d) {
      if (!d) return '';
      const diff = Date.now() - new Date(d).getTime();
      const m = Math.floor(diff/60000);
      if (m < 60) return m + 'm ago';
      const h = Math.floor(m/60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h/24) + 'd ago';
    }
    
    function statusColor(s) {
      const m = { open:'#0099ff', ai_handling:'#6a4cf5', escalated:'#ff5577', resolved:'#22c55e', closed:'#555' };
      return m[s] || '#999';
    }
    
    function setConvTab(tab) {
      ['all','escalated','resolved'].forEach(t => {
        const btn = document.getElementById('tab-'+t);
        btn.style.background = t === tab ? '#1c1c1c' : 'none';
        btn.style.color = t === tab ? '#fff' : '#666';
      });
      currentTabFilter = tab === 'all' ? '' : tab;
      loadConversations();
    }
    
    async function loadConversations() {
      let url = '/api/conversations?limit=50';
      if (currentTabFilter) url += '&status=' + currentTabFilter;
      document.getElementById('conv-list').innerHTML = '<div style="padding:20px; text-align:center; color:#555;"><i class="fas fa-spinner fa-spin"></i></div>';
      try {
        const data = await authFetch(url).then(r => r.json());
        const convs = data.conversations || [];
        document.getElementById('inbox-count').textContent = convs.length + ' conversations';
        if (!convs.length) {
          document.getElementById('conv-list').innerHTML = '<div style="padding:24px; text-align:center; color:#555; font-size:13px;">No conversations yet</div>';
          return;
        }
        document.getElementById('conv-list').innerHTML = convs.map((c, i) => {
          const initials = (c.customer_name||'??').slice(0,2).toUpperCase();
          const hue = (c.customer_name||'A').charCodeAt(0) * 15 % 360;
          return \`<div onclick="openConversation('\${c.id}')" id="conv-item-\${c.id}" style="padding:14px 16px; border-bottom:1px solid #1a1a1a; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='#141414'" onmouseout="this.style.background='transparent'">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <div style="width:32px; height:32px; background:linear-gradient(135deg,hsl(\${hue},70%,55%),hsl(\${hue+60},70%,45%)); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;">\${initials}</div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                  <span style="font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${c.customer_name||'Visitor'}</span>
                  <span style="font-size:11px; color:#555; flex-shrink:0;">\${timeAgo(c.updated_at)}</span>
                </div>
                <div style="font-size:11px; color:#555; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${c.customer_email||c.channel}</div>
                <span style="font-size:10px; background:rgba(0,0,0,0.3); color:\${statusColor(c.status)}; border:1px solid \${statusColor(c.status)}33; padding:2px 8px; border-radius:100px;">\${c.status}</span>
              </div>
            </div>
          </div>\`;
        }).join('');
      } catch(e) {
        document.getElementById('conv-list').innerHTML = '<div style="padding:20px; color:#ff5577; font-size:13px;">Failed to load conversations</div>';
      }
    }
    
    async function openConversation(convId) {
      currentConvId = convId;
      // Highlight selected
      document.querySelectorAll('[id^=conv-item-]').forEach(el => el.style.borderLeft = 'none');
      const el = document.getElementById('conv-item-' + convId);
      if (el) el.style.borderLeft = '2px solid #6a4cf5';
      
      document.getElementById('chat-empty').style.display = 'none';
      document.getElementById('chat-panel').style.display = 'flex';
      document.getElementById('chat-messages').innerHTML = '<div style="text-align:center; color:#555; padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';
      
      try {
        const [convRes, msgRes] = await Promise.all([
          authFetch('/api/conversations/' + convId).then(r => r.json()),
          authFetch('/api/conversations/' + convId + '/messages').then(r => r.json()),
        ]);
        const conv = convRes.conversation;
        const msgs = msgRes.messages || [];
        
        // Update header
        const initials = (conv.customer_name||'??').slice(0,2).toUpperCase();
        document.getElementById('chat-avatar').textContent = initials;
        document.getElementById('chat-name').textContent = conv.customer_name || 'Visitor';
        document.getElementById('chat-meta').textContent = (conv.customer_email||conv.channel||'widget') + ' • ' + conv.status;
        
        const statusBadgeEl = document.getElementById('chat-status-badge');
        statusBadgeEl.textContent = conv.status;
        statusBadgeEl.className = 'badge ' + ({open:'badge-open',escalated:'badge-urgent',resolved:'badge-resolved',ai_handling:'badge-medium'}[conv.status]||'badge-low');
        
        // Render messages
        document.getElementById('chat-messages').innerHTML = msgs.length ? msgs.map(m => {
          const isCustomer = m.sender_type === 'customer';
          const isSystem = m.sender_type === 'system';
          if (isSystem) return \`<div style="display:flex; justify-content:center; margin:4px 0;"><div style="background:rgba(106,76,245,0.15); border:1px solid rgba(106,76,245,0.3); border-radius:100px; padding:4px 14px; font-size:11px; color:#6a4cf5;">\${m.content}</div></div>\`;
          const confidence = m.confidence ? \`<span style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:100px; color:#666; margin-left:4px;">Confidence: \${Math.round(m.confidence*100)}%</span>\` : '';
          const sources = m.sources && JSON.parse(m.sources||'[]').length ? \`<div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">\${JSON.parse(m.sources).map(s=>\`<span style="font-size:10px; background:rgba(106,76,245,0.2); color:#6a4cf5; padding:2px 8px; border-radius:100px; border:1px solid rgba(106,76,245,0.3);">📄 \${s}</span>\`).join('')}</div>\` : '';
          if (isCustomer) return \`<div style="display:flex; gap:10px; flex-direction:row-reverse; align-items:flex-start;">
            <div style="width:28px; height:28px; background:#ff5577; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;">\${initials}</div>
            <div><div style="background:#1c1c1c; border-radius:12px 12px 4px 12px; padding:12px 14px; max-width:80%;"><div style="font-size:13px; line-height:1.6; color:#ccc;">\${m.content}</div></div>
            <div style="font-size:11px; color:#555; margin-top:4px; text-align:right;">\${timeAgo(m.created_at)}</div></div>
          </div>\`;
          return \`<div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="width:28px; height:28px; background:linear-gradient(135deg,#6a4cf5,#d44df0); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; flex-shrink:0;"><i class="fas fa-bolt" style="color:white;"></i></div>
            <div><div style="background:rgba(106,76,245,0.12); border-radius:12px 12px 12px 4px; padding:12px 14px; max-width:80%;">
              <div style="font-size:11px; color:#6a4cf5; margin-bottom:4px; font-weight:600;">\${m.sender_type === 'ai' ? 'SupportIQ AI' : 'Agent'} \${confidence}</div>
              <div style="font-size:13px; line-height:1.6; color:#ccc;">\${m.content}</div>\${sources}
            </div><div style="font-size:11px; color:#555; margin-top:4px;">\${timeAgo(m.created_at)}</div></div>
          </div>\`;
        }).join('') : '<div style="text-align:center; color:#555; font-size:13px; padding:20px;">No messages yet</div>';
        
        // Scroll to bottom
        const msgEl = document.getElementById('chat-messages');
        msgEl.scrollTop = msgEl.scrollHeight;
      } catch(e) {
        document.getElementById('chat-messages').innerHTML = '<div style="color:#ff5577; padding:20px;">Failed to load messages</div>';
      }
    }
    
    async function sendReply() {
      if (!currentConvId) return;
      const input = document.getElementById('reply-input');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      try {
        await authFetch('/api/conversations/' + currentConvId + '/messages', {
          method:'POST',
          body: JSON.stringify({ content, sender_type: 'agent' })
        });
        openConversation(currentConvId);
      } catch(e) { input.value = content; }
    }
    
    async function markResolved() {
      if (!currentConvId) return;
      try {
        await authFetch('/api/conversations/' + currentConvId + '/status', {
          method:'PATCH',
          body: JSON.stringify({ status: 'resolved' })
        });
        loadConversations();
        openConversation(currentConvId);
      } catch(e) {}
    }
    
    async function getDraftReply() {
      if (!currentConvId) return;
      const btn = event.target.closest('button');
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        const data = await authFetch('/api/chat/agent', {
          method:'POST',
          body: JSON.stringify({ conversation_id: currentConvId })
        }).then(r => r.json());
        if (data.draft) {
          document.getElementById('reply-input').value = data.draft;
        }
      } catch(e) {}
      btn.innerHTML = '<i class="fas fa-robot"></i> AI Draft';
    }
    
    function insertCanned(text) { document.getElementById('reply-input').value = text; }
    
    loadConversations();
  </script>`
}

function getTicketsContent(): string {
  return `
  <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Tickets</h1>
      <p style="font-size: 14px; color: #666;" id="ticket-count">Loading tickets...</p>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <select id="status-filter" onchange="loadTickets()" style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 8px 16px; color: #999; font-size: 13px; outline: none; cursor: pointer; font-family: inherit;">
        <option value="">All Status</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <select id="priority-filter" onchange="loadTickets()" style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 8px 16px; color: #999; font-size: 13px; outline: none; cursor: pointer; font-family: inherit;">
        <option value="">All Priority</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <button class="btn-primary" onclick="showNewTicketModal()"><i class="fas fa-plus"></i> New Ticket</button>
    </div>
  </div>

  <!-- New Ticket Modal -->
  <div id="new-ticket-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#141414; border:1px solid #262626; border-radius:20px; width:520px; max-width:90vw; padding:28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:18px; font-weight:600;">Create New Ticket</h2>
        <button onclick="hideNewTicketModal()" style="background:none; border:none; color:#666; font-size:18px; cursor:pointer;">×</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label style="font-size:13px; color:#999; margin-bottom:6px; display:block;">Subject *</label>
          <input id="nt-subject" type="text" placeholder="Brief description of the issue" style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit;">
        </div>
        <div>
          <label style="font-size:13px; color:#999; margin-bottom:6px; display:block;">Description</label>
          <textarea id="nt-description" placeholder="Detailed description..." style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit; resize:vertical; min-height:80px;"></textarea>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:13px; color:#999; margin-bottom:6px; display:block;">Priority</label>
            <select id="nt-priority" style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit;">
              <option value="medium">Medium</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px; color:#999; margin-bottom:6px; display:block;">Customer Name</label>
            <input id="nt-customer" type="text" placeholder="Customer name" style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit;">
          </div>
        </div>
        <div>
          <label style="font-size:13px; color:#999; margin-bottom:6px; display:block;">Customer Email</label>
          <input id="nt-email" type="email" placeholder="customer@example.com" style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit;">
        </div>
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:24px;">
        <button onclick="hideNewTicketModal()" class="btn-secondary">Cancel</button>
        <button onclick="submitNewTicket()" class="btn-primary" id="submit-ticket-btn"><i class="fas fa-plus"></i> Create Ticket</button>
      </div>
    </div>
  </div>

  <!-- Ticket Detail Modal -->
  <div id="ticket-detail-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#141414; border:1px solid #262626; border-radius:20px; width:640px; max-width:95vw; max-height:85vh; overflow-y:auto; padding:28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-size:18px; font-weight:600;" id="td-subject">Ticket Detail</h2>
        <button onclick="hideTicketDetail()" style="background:none; border:none; color:#666; font-size:18px; cursor:pointer;">×</button>
      </div>
      <div id="td-content" style="font-size:13px; color:#ccc; line-height:1.8;"></div>
      <div style="margin-top:24px;">
        <h3 style="font-size:14px; font-weight:600; margin-bottom:12px;">Add Comment</h3>
        <textarea id="td-comment" placeholder="Add a comment or internal note..." style="width:100%; background:#1c1c1c; border:1px solid #262626; border-radius:8px; padding:10px 14px; color:#fff; font-size:13px; outline:none; font-family:inherit; resize:vertical; min-height:80px;"></textarea>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
          <button onclick="hideTicketDetail()" class="btn-secondary">Close</button>
          <button onclick="submitComment()" class="btn-primary"><i class="fas fa-paper-plane"></i> Comment</button>
        </div>
      </div>
    </div>
  </div>
  
  <div class="card" id="tickets-table">
    <!-- Table header -->
    <div style="display: grid; grid-template-columns: 110px 1fr 130px 100px 120px 80px; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #1a1a1a; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">
      <div>ID</div>
      <div>Subject</div>
      <div>Customer</div>
      <div>Priority</div>
      <div>Status</div>
      <div>Created</div>
    </div>
    <div id="tickets-body">
      <div style="padding: 40px; text-align: center; color: #555;">
        <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px;"></i>
        <div>Loading tickets...</div>
      </div>
    </div>
  </div>

  <script>
    let currentTicketId = null;
    
    function timeAgo(dateStr) {
      const d = new Date(dateStr);
      const diff = Date.now() - d.getTime();
      const m = Math.floor(diff / 60000);
      if (m < 60) return m + 'm ago';
      const h = Math.floor(m / 60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h/24) + 'd ago';
    }
    
    function priorityBadge(p) {
      const map = { urgent:'badge-urgent', high:'badge-high', medium:'badge-medium', low:'badge-low' };
      return '<span class="badge ' + (map[p]||'badge-low') + '">' + (p||'').charAt(0).toUpperCase()+(p||'').slice(1) + '</span>';
    }
    
    function statusBadge(s) {
      const map = { open:'badge-open', in_progress:'badge-progress', resolved:'badge-resolved', closed:'badge-low' };
      const labels = { open:'Open', in_progress:'In Progress', resolved:'Resolved', closed:'Closed' };
      return '<span class="badge ' + (map[s]||'badge-low') + '">' + (labels[s]||s) + '</span>';
    }
    
    async function loadTickets() {
      const status = document.getElementById('status-filter').value;
      const priority = document.getElementById('priority-filter').value;
      let url = '/api/tickets?limit=50';
      if (status) url += '&status=' + status;
      if (priority) url += '&priority=' + priority;
      
      try {
        const data = await authFetch(url).then(r => r.json());
        const tickets = data.tickets || [];
        document.getElementById('ticket-count').textContent = tickets.length + ' tickets';
        
        if (!tickets.length) {
          document.getElementById('tickets-body').innerHTML = '<div style="padding:40px; text-align:center; color:#555;"><i class="fas fa-ticket" style="font-size:32px; margin-bottom:12px; display:block;"></i>No tickets found. Create your first one!</div>';
          return;
        }
        
        document.getElementById('tickets-body').innerHTML = tickets.map(t => \`
        <div onclick="openTicketDetail('\${t.id}')" style="display:grid; grid-template-columns:110px 1fr 130px 100px 120px 80px; gap:12px; padding:14px 20px; border-bottom:1px solid #1a1a1a; cursor:pointer; transition:background 0.15s; align-items:center; font-size:13px;" onmouseover="this.style.background='#141414'" onmouseout="this.style.background='transparent'">
          <div style="font-family:monospace; color:#666; font-size:12px;">\${t.id.slice(-8).toUpperCase()}</div>
          <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${t.subject}</div>
          <div style="color:#999; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${t.customer_name||t.customer_email||'Unknown'}</div>
          <div>\${priorityBadge(t.priority)}</div>
          <div>\${statusBadge(t.status)}</div>
          <div style="color:#555; font-size:12px;">\${timeAgo(t.created_at)}</div>
        </div>\`).join('');
      } catch(e) {
        document.getElementById('tickets-body').innerHTML = '<div style="padding:40px; text-align:center; color:#ff5577;"><i class="fas fa-exclamation-circle" style="font-size:24px; margin-bottom:8px; display:block;"></i>Failed to load tickets.</div>';
      }
    }
    
    async function openTicketDetail(ticketId) {
      currentTicketId = ticketId;
      document.getElementById('ticket-detail-modal').style.display = 'flex';
      document.getElementById('td-content').innerHTML = '<div style="text-align:center; padding:20px; color:#555;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
      try {
        const [ticketRes, commentsRes] = await Promise.all([
          authFetch('/api/tickets/' + ticketId).then(r => r.json()),
          authFetch('/api/tickets/' + ticketId + '/comments').then(r => r.json()),
        ]);
        const t = ticketRes.ticket;
        const comments = commentsRes.comments || [];
        document.getElementById('td-subject').textContent = t.subject;
        document.getElementById('td-content').innerHTML = \`
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
            \${priorityBadge(t.priority)} \${statusBadge(t.status)}
            <span style="font-size:12px; color:#666;">\${t.customer_name||''} \${t.customer_email ? '('+t.customer_email+')' : ''}</span>
          </div>
          <div style="margin-bottom:16px; color:#aaa;">\${t.description || 'No description provided.'}</div>
          <div style="border-top:1px solid #1a1a1a; padding-top:16px;">
            <div style="font-size:12px; color:#555; margin-bottom:12px;">SLA Due: \${t.sla_due_at ? new Date(t.sla_due_at).toLocaleString() : 'N/A'}</div>
            \${comments.length ? '<div style="font-weight:600; font-size:13px; margin-bottom:10px;">Comments (' + comments.length + ')</div>' + comments.map(c => \`<div style="background:#1c1c1c; border-radius:8px; padding:12px; margin-bottom:8px;"><div style="font-size:11px; color:#555; margin-bottom:4px;">\${timeAgo(c.created_at)}</div><div style="font-size:13px; color:#ccc;">\${c.content}</div></div>\`).join('') : '<div style="color:#555; font-size:13px;">No comments yet.</div>'}
          </div>\`
        ;
      } catch(e) {
        document.getElementById('td-content').innerHTML = '<div style="color:#ff5577;">Failed to load ticket detail.</div>';
      }
    }
    
    function hideTicketDetail() {
      document.getElementById('ticket-detail-modal').style.display = 'none';
      currentTicketId = null;
    }
    
    async function submitComment() {
      if (!currentTicketId) return;
      const content = document.getElementById('td-comment').value.trim();
      if (!content) return;
      await authFetch('/api/tickets/' + currentTicketId + '/comments', {
        method:'POST', body: JSON.stringify({ content, is_internal: false })
      });
      document.getElementById('td-comment').value = '';
      openTicketDetail(currentTicketId);
    }
    
    function showNewTicketModal() {
      document.getElementById('new-ticket-modal').style.display = 'flex';
    }
    function hideNewTicketModal() {
      document.getElementById('new-ticket-modal').style.display = 'none';
    }
    
    async function submitNewTicket() {
      const subject = document.getElementById('nt-subject').value.trim();
      if (!subject) return alert('Subject is required');
      const btn = document.getElementById('submit-ticket-btn');
      btn.disabled = true; btn.textContent = 'Creating...';
      try {
        await authFetch('/api/tickets', {
          method:'POST',
          body: JSON.stringify({
            subject,
            description: document.getElementById('nt-description').value,
            priority: document.getElementById('nt-priority').value,
            customer_name: document.getElementById('nt-customer').value,
            customer_email: document.getElementById('nt-email').value,
            channel: 'manual',
          })
        });
        hideNewTicketModal();
        loadTickets();
      } catch(e) {
        alert('Failed to create ticket');
      } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create Ticket';
      }
    }
    
    loadTickets();
  </script>`
}

function getKnowledgeBaseContent(): string {
  return `
  <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Knowledge Base</h1>
      <p style="font-size: 14px; color: #666;">Manage your AI's knowledge sources</p>
    </div>
    <button class="btn-primary" onclick="showUploadModal()"><i class="fas fa-plus"></i> New Knowledge Base</button>
  </div>
  
  <!-- KB Cards (populated by JS) -->
  <div id="kb-cards-container" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
    <div style="color: #555; font-size: 13px; grid-column: 1/-1; padding: 20px 0;"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading knowledge bases...</div>
  </div>
  
  <!-- Upload area -->
  <div class="card" style="padding: 32px;" id="upload-area">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="font-size: 16px; font-weight: 600;">Upload Documents</h2>
      <span id="selected-kb-name" style="font-size: 12px; color: #6a4cf5; background: rgba(106,76,245,0.1); padding: 4px 12px; border-radius: 100px;">Select a knowledge base above first</span>
    </div>
    
    <div style="border: 2px dashed #262626; border-radius: 16px; padding: 48px; text-align: center; cursor: pointer; transition: all 0.2s;" 
         id="drop-zone"
         ondragover="event.preventDefault(); this.style.borderColor='#6a4cf5'; this.style.background='rgba(106,76,245,0.05)'"
         ondragleave="this.style.borderColor='#262626'; this.style.background='transparent'"
         ondrop="handleDrop(event)"
         onclick="document.getElementById('file-input').click()">
      <div style="width: 52px; height: 52px; background: rgba(106,76,245,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
        <i class="fas fa-cloud-upload-alt" style="color: #6a4cf5; font-size: 22px;"></i>
      </div>
      <div style="font-size: 15px; font-weight: 500; margin-bottom: 6px;">Drop files here or click to browse</div>
      <div style="font-size: 13px; color: #555;">Supports PDF, DOCX, TXT, MD • Max 50MB per file</div>
      <input type="file" id="file-input" multiple accept=".pdf,.docx,.txt,.md" style="display: none;" onchange="handleFileSelect(event)">
    </div>
    
    <!-- Progress (initially hidden) -->
    <div id="upload-progress" style="display: none; margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 13px; font-weight: 500;" id="upload-filename">uploading...</span>
        <span style="font-size: 12px; color: #666;" id="upload-pct">0%</span>
      </div>
      <div style="height: 4px; background: #1a1a1a; border-radius: 2px; overflow: hidden;">
        <div id="progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #6a4cf5, #d44df0); border-radius: 2px; transition: width 0.3s;"></div>
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 8px;" id="upload-status">Uploading...</div>
    </div>
  </div>
  
  <script>
    // Load KBs and render cards dynamically
    const kbToken = localStorage.getItem('siq_token');

    function kbFetch(url, opts = {}) {
      return fetch(url, { ...opts, headers: { 'Authorization': 'Bearer ' + kbToken, ...(opts.headers || {}) } });
    }

    let selectedKbId = null;

    async function loadKBs() {
      try {
        const res = await kbFetch('/api/knowledge-bases');
        const data = await res.json();
        const container = document.getElementById('kb-cards-container');
        if (!container || !data.kbs) return;
        if (data.kbs.length === 0) {
          container.innerHTML = '<p style="color:#666;font-size:13px;">No knowledge bases yet. Create one to get started.</p>';
          return;
        }
        container.innerHTML = data.kbs.map(kb => \`
          <div class="card" style="padding: 24px; cursor: pointer;" onclick="selectKB('\${kb.id}', '\${kb.name}')">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
              <div style="width: 40px; height: 40px; background: \${kb.color}22; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-book" style="color: \${kb.color}; font-size: 16px;"></i>
              </div>
              <span style="font-size: 11px; background: \${kb.status === 'indexed' ? 'rgba(34,197,94,0.15)' : 'rgba(255,122,61,0.15)'}; color: \${kb.status === 'indexed' ? '#22c55e' : '#ff7a3d'}; padding: 3px 10px; border-radius: 100px;">\${kb.status}</span>
            </div>
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">\${kb.name}</h3>
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
              <div><div style="font-size: 18px; font-weight: 700;">\${kb.doc_count || 0}</div><div style="font-size: 11px; color: #666;">Documents</div></div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-secondary" style="font-size: 12px; padding: 6px 14px;" onclick="event.stopPropagation(); selectKB('\${kb.id}','\${kb.name}')"><i class="fas fa-upload"></i> Upload</button>
              <button class="btn-secondary" style="font-size: 12px; padding: 6px 14px; color: #ff5577; border-color: rgba(255,85,119,0.3);" onclick="event.stopPropagation(); deleteKB('\${kb.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>\`).join('');
      } catch(e) { console.error(e); }
    }

    function selectKB(id, name) {
      selectedKbId = id;
      document.getElementById('selected-kb-name').textContent = 'Upload to: ' + name;
      document.getElementById('upload-area').scrollIntoView({ behavior: 'smooth' });
    }

    async function deleteKB(id) {
      if (!confirm('Delete this knowledge base and all its documents?')) return;
      await kbFetch('/api/knowledge-bases/' + id, { method: 'DELETE' });
      loadKBs();
    }

    function handleDrop(e) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length) uploadFile(files[0]);
    }
    
    function handleFileSelect(e) {
      if (e.target.files.length) uploadFile(e.target.files[0]);
    }

    async function uploadFile(file) {
      if (!selectedKbId) {
        alert('Please select a knowledge base first by clicking on one above.');
        return;
      }
      const progress = document.getElementById('upload-progress');
      const bar = document.getElementById('progress-bar');
      const pct = document.getElementById('upload-pct');
      const fname = document.getElementById('upload-filename');
      const status = document.getElementById('upload-status');
      progress.style.display = 'block';
      fname.textContent = file.name;
      bar.style.width = '10%'; pct.textContent = '10%'; status.textContent = 'Uploading to R2...';

      try {
        const formData = new FormData();
        formData.append('file', file);
        bar.style.width = '40%'; pct.textContent = '40%';
        const res = await fetch('/api/knowledge-bases/' + selectedKbId + '/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + kbToken },
          body: formData
        });
        bar.style.width = '80%'; pct.textContent = '80%'; status.textContent = 'Processing...';
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        bar.style.width = '100%'; pct.textContent = '100%';
        status.textContent = '✓ Indexed successfully! ' + data.chunk_count + ' chunks stored.';
        loadKBs();
      } catch(err) {
        status.textContent = '✗ Error: ' + err.message;
        bar.style.background = '#ff5577';
      }
    }
    
    function showUploadModal() {
      document.getElementById('upload-area').scrollIntoView({ behavior: 'smooth' });
    }

    loadKBs();
  </script>`
}

function getAnalyticsContent(): string {
  return `
  <div style="margin-bottom: 28px; display:flex; justify-content:space-between; align-items:center;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Analytics</h1>
      <p style="font-size: 14px; color: #666;" id="analytics-range">AI performance and support metrics — last 30 days</p>
    </div>
    <button class="btn-secondary" onclick="refreshAnalytics()"><i class="fas fa-sync"></i> Refresh</button>
  </div>
  
  <!-- Top metrics (from API) -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;" id="analytics-stats">
    <div class="card stat-card" style="display:flex; align-items:center; justify-content:center; min-height:100px;"><i class="fas fa-spinner fa-spin" style="color:#555;"></i></div>
    <div class="card stat-card" style="display:flex; align-items:center; justify-content:center; min-height:100px;"><i class="fas fa-spinner fa-spin" style="color:#555;"></i></div>
    <div class="card stat-card" style="display:flex; align-items:center; justify-content:center; min-height:100px;"><i class="fas fa-spinner fa-spin" style="color:#555;"></i></div>
    <div class="card stat-card" style="display:flex; align-items:center; justify-content:center; min-height:100px;"><i class="fas fa-spinner fa-spin" style="color:#555;"></i></div>
  </div>
  
  <!-- Charts -->
  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Ticket Volume & AI Resolutions</h2>
      <div style="height: 220px;"><canvas id="volumeChart"></canvas></div>
    </div>
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Resolution Breakdown</h2>
      <div style="height: 160px; margin-bottom: 12px;"><canvas id="aiChart"></canvas></div>
      <div id="resolution-details" style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#666;"></div>
    </div>
  </div>
  
  <!-- Priority breakdown -->
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">Ticket Priority Distribution</h2>
    <div id="priority-bars" style="display:flex; flex-direction:column; gap:12px;">
      <div style="color:#555; font-size:13px;">Loading...</div>
    </div>
  </div>
  
  <!-- Team performance from real data -->
  <div class="card" style="padding: 24px;">
    <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">Team Members</h2>
    <div id="team-list">
      <div style="color:#555; font-size:13px; padding:8px;">Loading team data...</div>
    </div>
  </div>
  
  <script>
    function statCard(icon, color, bg, label, value, subtext) {
      return \`<div class="card stat-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <div style="width:36px; height:36px; background:\${bg}; border-radius:10px; display:flex; align-items:center; justify-content:center;">
            <i class="fas fa-\${icon}" style="color:\${color}; font-size:14px;"></i>
          </div>
        </div>
        <div style="font-size:26px; font-weight:700; letter-spacing:-1px;">\${value}</div>
        <div style="font-size:13px; color:#666; margin-top:2px;">\${label}</div>
        \${subtext ? \`<div style="font-size:11px; color:#555; margin-top:6px;">\${subtext}</div>\` : ''}
      </div>\`;
    }
    
    async function refreshAnalytics() {
      // Load stats
      const [statsData, aiData] = await Promise.all([
        authFetch('/api/stats').then(r => r.json()).catch(() => ({})),
        authFetch('/api/stats/ai').then(r => r.json()).catch(() => ({})),
      ]);
      
      const t = statsData.tickets || {};
      const bd = statsData.resolutionBreakdown || {};
      const aiRate = t.total > 0 ? Math.round((bd.resolved||0)/Math.max(t.total,1)*100) : 0;
      
      document.getElementById('analytics-stats').innerHTML =
        statCard('robot', '#22c55e', 'rgba(34,197,94,0.15)', 'AI Resolution Rate', aiRate + '%', \`\${bd.resolved||0} resolved / \${bd.escalated||0} escalated\`) +
        statCard('clock', '#0099ff', 'rgba(0,153,255,0.15)', 'Avg Response Time', statsData.avgResponseTime || 'N/A', 'last 30 days') +
        statCard('exclamation-triangle', '#ff5577', 'rgba(255,85,119,0.15)', 'Escalation Rate', (aiData.escalation_rate||0) + '%', \`\${aiData.total_ai_messages||0} AI messages\`) +
        statCard('ticket', '#6a4cf5', 'rgba(106,76,245,0.15)', 'Total Tickets', (t.total||0).toLocaleString(), \`Open: \${t.open||0} · In Progress: \${t.in_progress||0}\`);
      
      // Resolution details
      const total = (bd.resolved||0) + (bd.escalated||0) + (bd.pending||0);
      document.getElementById('resolution-details').innerHTML = [
        ['Resolved', bd.resolved||0, '#22c55e'],
        ['Escalated', bd.escalated||0, '#ff5577'],
        ['Pending', bd.pending||0, '#6a4cf5'],
      ].map(([label, count, color]) => \`
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:8px; height:8px; background:\${color}; border-radius:50%;"></div>
            <span>\${label}</span>
          </div>
          <span style="font-weight:500; color:\${color};">\${count} (\${total ? Math.round(count/total*100) : 0}%)</span>
        </div>\`).join('');
      
      // Priority bars
      const pmap = statsData.priorityBreakdown || {};
      const maxP = Math.max(...Object.values(pmap).map(Number), 1);
      const priorities = [['urgent','#ff5577'],['high','#ff7a3d'],['medium','#6a4cf5'],['low','#555']];
      document.getElementById('priority-bars').innerHTML = priorities.map(([p, color]) => {
        const count = pmap[p] || 0;
        const pct = Math.round((count / maxP) * 100);
        return \`<div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px; color:#666;">
            <span>\${p.charAt(0).toUpperCase()+p.slice(1)}</span>
            <span>\${count} tickets</span>
          </div>
          <div style="background:#1a1a1a; border-radius:4px; height:6px;">
            <div style="width:\${pct}%; height:100%; background:\${color}; border-radius:4px; transition:width 0.5s;"></div>
          </div>
        </div>\`;
      }).join('');
      
      // Team from settings
      authFetch('/api/settings/team').then(r => r.json()).then(d => {
        const team = d.team || [];
        if (!team.length) {
          document.getElementById('team-list').innerHTML = '<div style="color:#555; font-size:13px;">No team members yet.</div>';
          return;
        }
        const colors = ['#6a4cf5','#d44df0','#0099ff','#22c55e','#ff7a3d'];
        document.getElementById('team-list').innerHTML = \`<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">\` +
          team.map((u, i) => {
            const initials = ((u.first_name||'')[0]||'') + ((u.last_name||'')[0]||'');
            const color = colors[i % colors.length];
            return \`<div style="background:#1c1c1c; border-radius:12px; padding:16px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <div style="width:36px; height:36px; background:\${color}22; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:\${color};">\${initials.toUpperCase()||'?'}</div>
                <div>
                  <div style="font-size:13px; font-weight:500;">\${u.first_name} \${u.last_name}</div>
                  <div style="font-size:11px; color:#666;">\${u.role} · \${u.email}</div>
                </div>
              </div>
              <span style="font-size:10px; background:\${color}22; color:\${color}; padding:2px 8px; border-radius:100px;">\${u.is_active ? 'Active' : 'Inactive'}</span>
            </div>\`;
          }).join('') + '</div>';
      }).catch(() => {});
    }
    
    refreshAnalytics();
  </script>`
}

function getSettingsContent(): string {
  const navSections = [
    { id: 'workspace', icon: 'building', label: 'Workspace' },
    { id: 'ai', icon: 'robot', label: 'AI Settings' },
    { id: 'widget', icon: 'palette', label: 'Widget Design' },
    { id: 'notifications', icon: 'bell', label: 'Notifications' },
    { id: 'team', icon: 'users', label: 'Team & Roles' },
    { id: 'billing', icon: 'credit-card', label: 'Billing' },
    { id: 'integrations', icon: 'plug', label: 'Integrations' },
    { id: 'apikeys', icon: 'key', label: 'API Keys' },
  ]

  return `
  <div style="margin-bottom: 28px;">
    <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Settings</h1>
    <p style="font-size: 14px; color: #666;">Manage your workspace and AI configuration</p>
  </div>

  <div style="display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: start;">
    <!-- Settings nav -->
    <div style="position: sticky; top: 24px;">
      ${navSections.map(s => `
      <div id="nav-${s.id}" class="settings-nav-item" data-section="${s.id}"
        style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;margin-bottom:2px;font-size:13px;transition:all 0.15s;"
        onclick="showSection('${s.id}')">
        <i class="fas fa-${s.icon}" style="width:16px;text-align:center;"></i> ${s.label}
      </div>`).join('')}
    </div>

    <!-- Settings panels -->
    <div style="display:flex;flex-direction:column;gap:16px;">

      <!-- ── WORKSPACE ────────────────────────────── -->
      <div id="section-workspace" class="settings-section">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:20px;">Workspace Settings</h2>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Workspace Name</label>
              <input id="ws-name" class="input-field" placeholder="My Company" style="width:100%;max-width:400px;">
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Timezone</label>
              <select id="ws-timezone" class="input-field" style="max-width:400px;cursor:pointer;">
                <option value="UTC-5">UTC-5 Eastern Time</option>
                <option value="UTC-8">UTC-8 Pacific Time</option>
                <option value="UTC+0">UTC+0 GMT</option>
                <option value="UTC+1">UTC+1 CET</option>
                <option value="UTC+5:30">UTC+5:30 IST</option>
                <option value="UTC+8">UTC+8 CST/SGT</option>
                <option value="UTC+9">UTC+9 JST</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Plan</label>
              <div id="ws-plan" style="font-size:13px;padding:9px 12px;background:#1c1c1c;border:1px solid #262626;border-radius:8px;max-width:400px;color:#999;">Loading…</div>
            </div>
            <button onclick="saveWorkspace()" class="btn-primary" style="width:fit-content;" id="save-workspace-btn">Save Changes</button>
            <div id="ws-save-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Saved</div>
          </div>
        </div>
      </div>

      <!-- ── AI SETTINGS ──────────────────────────── -->
      <div id="section-ai" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">AI Configuration</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Configure how the AI assistant responds to customers</p>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Confidence Threshold for Escalation</label>
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="range" min="0" max="100" value="50" style="flex:1;max-width:300px;accent-color:#6a4cf5;" id="ai-threshold"
                  oninput="document.getElementById('ai-threshold-val').textContent = this.value + '%'">
                <span style="font-size:14px;font-weight:600;min-width:40px;" id="ai-threshold-val">50%</span>
              </div>
              <div style="font-size:12px;color:#555;margin-top:4px;">AI escalates to human when confidence is below this threshold</div>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Escalation Keywords</label>
              <input id="ai-keywords" class="input-field" placeholder="refund, cancel, angry, lawsuit, urgent" style="width:100%;max-width:400px;">
              <div style="font-size:12px;color:#555;margin-top:4px;">Comma-separated keywords that trigger immediate escalation</div>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">AI Welcome Message</label>
              <textarea id="ai-welcome" class="input-field" style="width:100%;max-width:500px;resize:vertical;min-height:80px;"
                placeholder="Hi! I'm your AI support assistant. How can I help you?"></textarea>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;max-width:400px;padding:14px;background:#1c1c1c;border-radius:10px;">
              <div>
                <div style="font-size:13px;font-weight:500;">Allow customer to request human</div>
                <div style="font-size:12px;color:#666;">Show "Talk to agent" button anytime</div>
              </div>
              <div id="ai-human-toggle" onclick="toggleHuman()" style="width:44px;height:24px;background:#22c55e;border-radius:100px;position:relative;cursor:pointer;">
                <div style="position:absolute;right:3px;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all 0.2s;" id="ai-human-dot"></div>
              </div>
            </div>
            <button onclick="saveAI()" class="btn-primary" style="width:fit-content;">Save AI Settings</button>
            <div id="ai-save-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Saved</div>
          </div>
        </div>
      </div>

      <!-- ── WIDGET DESIGN ────────────────────────── -->
      <div id="section-widget" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">Widget Design & Embed</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Customize your chat widget appearance and get your embed code</p>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Primary Color</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" id="widget-color" value="#6a4cf5" style="width:44px;height:36px;border:none;background:none;cursor:pointer;border-radius:6px;"
                  oninput="updateEmbedPreview()">
                <input id="widget-color-hex" class="input-field" value="#6a4cf5" style="max-width:120px;"
                  oninput="document.getElementById('widget-color').value=this.value; updateEmbedPreview()">
              </div>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Widget Position</label>
              <select id="widget-position" class="input-field" style="max-width:200px;cursor:pointer;" oninput="updateEmbedPreview()">
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Greeting Message</label>
              <input id="widget-greeting" class="input-field" placeholder="Hi! How can I help you today?" style="width:100%;max-width:400px;"
                oninput="updateEmbedPreview()">
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Input Placeholder</label>
              <input id="widget-placeholder" class="input-field" placeholder="Ask me anything…" style="width:100%;max-width:400px;">
            </div>
            <button onclick="saveWidget()" class="btn-primary" style="width:fit-content;">Save Widget Settings</button>
            <div id="widget-save-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Saved</div>
          </div>
        </div>

        <!-- Embed code -->
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">Embed Code</h2>
          <p style="font-size:13px;color:#666;margin-bottom:16px;">Add this script to your website's <code style="background:#1c1c1c;padding:2px 6px;border-radius:4px;font-size:12px;">&lt;head&gt;</code> or before <code style="background:#1c1c1c;padding:2px 6px;border-radius:4px;font-size:12px;">&lt;/body&gt;</code></p>
          <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:10px;padding:16px;font-family:monospace;font-size:12px;color:#999;position:relative;max-width:620px;white-space:pre;overflow-x:auto;" id="embed-preview"></div>
          <div style="margin-top:12px;display:flex;gap:8px;align-items:center;">
            <button onclick="copyEmbed()" class="btn-secondary" style="font-size:12px;">
              <i class="fas fa-copy"></i> Copy Embed Code
            </button>
            <a href="/widget" class="btn-secondary" style="font-size:12px;text-decoration:none;" target="_blank">
              <i class="fas fa-eye"></i> Preview Widget
            </a>
            <span id="copy-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Copied!</span>
          </div>
          <div style="margin-top:16px;padding:14px;background:#1c1c1c;border-radius:10px;max-width:620px;">
            <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:#fff;">API Key</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <div id="api-key-display" style="font-family:monospace;font-size:12px;color:#999;background:#141414;padding:8px 12px;border-radius:6px;flex:1;min-width:200px;">No API key yet</div>
              <button onclick="generateApiKey()" class="btn-secondary" style="font-size:12px;" id="gen-key-btn">
                <i class="fas fa-key"></i> Generate New Key
              </button>
            </div>
            <div id="new-key-reveal" style="display:none;margin-top:10px;padding:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;">
              <div style="font-size:11px;color:#22c55e;margin-bottom:6px;font-weight:600;">⚠ Save this key now — it won't be shown again!</div>
              <div id="new-key-value" style="font-family:monospace;font-size:12px;color:#fff;word-break:break-all;"></div>
              <button onclick="copyKey()" style="margin-top:8px;background:#22c55e22;border:1px solid #22c55e55;border-radius:6px;padding:4px 10px;font-size:11px;color:#22c55e;cursor:pointer;">Copy Key</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── NOTIFICATIONS ────────────────────────── -->
      <div id="section-notifications" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">Notification Settings</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Configure email alerts for ticket events</p>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;max-width:450px;padding:14px;background:#1c1c1c;border-radius:10px;">
              <div>
                <div style="font-size:13px;font-weight:500;">Email Notifications</div>
                <div style="font-size:12px;color:#666;">Receive alerts for new escalations &amp; tickets</div>
              </div>
              <div id="notif-toggle" onclick="toggleNotif()" style="width:44px;height:24px;background:#333;border-radius:100px;position:relative;cursor:pointer;transition:background 0.2s;">
                <div id="notif-dot" style="position:absolute;left:3px;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all 0.2s;"></div>
              </div>
            </div>
            <div id="notif-email-row">
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Notification Email</label>
              <input id="notif-email" class="input-field" placeholder="alerts@company.com" type="email" style="max-width:400px;">
            </div>
            <button onclick="saveNotifications()" class="btn-primary" style="width:fit-content;">Save Notification Settings</button>
            <div id="notif-save-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Saved</div>
          </div>
        </div>
      </div>

      <!-- ── TEAM ─────────────────────────────────── -->
      <div id="section-team" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <h2 style="font-size:16px;font-weight:600;">Team & Roles</h2>
            <button onclick="showInviteModal()" class="btn-primary" style="font-size:13px;">
              <i class="fas fa-user-plus"></i> Invite Member
            </button>
          </div>
          <div id="team-members-list">
            <div style="color:#555;font-size:13px;">Loading team…</div>
          </div>
        </div>
      </div>

      <!-- ── BILLING ───────────────────────────────── -->
      <div id="section-billing" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">Billing &amp; Plan</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Manage your subscription and payment method</p>
          <div id="billing-info" style="display:flex;flex-direction:column;gap:16px;">
            <div style="color:#555;font-size:13px;">Loading billing info…</div>
          </div>
        </div>
      </div>

      <!-- ── INTEGRATIONS ──────────────────────────── -->
      <div id="section-integrations" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">Integrations</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Connect SupportIQ with your existing tools</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              { name: 'Slack', icon: 'fab fa-slack', desc: 'Post escalation alerts to a Slack channel', badge: 'Available', color: '#4a154b' },
              { name: 'Zapier', icon: 'fas fa-bolt', desc: 'Automate workflows with 5,000+ apps', badge: 'Available', color: '#ff4a00' },
              { name: 'Zendesk', icon: 'fas fa-headset', desc: 'Sync tickets bidirectionally with Zendesk', badge: 'Coming Soon', color: '#03363d' },
              { name: 'Intercom', icon: 'fas fa-comments', desc: 'Import conversations from Intercom', badge: 'Coming Soon', color: '#1f8ded' },
            ].map(i => `
            <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#1c1c1c;border-radius:12px;border:1px solid #262626;">
              <div style="width:40px;height:40px;background:${i.color}33;border-radius:10px;display:flex;align-items:center;justify-content:center;">
                <i class="${i.icon}" style="font-size:18px;color:${i.color === '#4a154b' ? '#a982cf' : i.color === '#ff4a00' ? '#ff7a3d' : '#6a4cf5'};"></i>
              </div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${i.name}</div>
                <div style="font-size:12px;color:#666;">${i.desc}</div>
              </div>
              <span style="font-size:11px;padding:4px 10px;border-radius:100px;background:${i.badge === 'Available' ? 'rgba(34,197,94,0.15)' : '#1c1c1c'};color:${i.badge === 'Available' ? '#22c55e' : '#555'};border:1px solid ${i.badge === 'Available' ? 'rgba(34,197,94,0.3)' : '#2a2a2a'};">${i.badge}</span>
              ${i.badge === 'Available' ? `<button onclick="connectIntegration('${i.name}')" class="btn-secondary" style="font-size:12px;">Connect</button>` : ''}
            </div>`).join('')}
          </div>
        </div>

        <!-- Slack webhook config -->
        <div class="card" style="padding:24px;" id="slack-config" style="display:none;">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
            <i class="fab fa-slack" style="color:#a982cf;"></i> Slack Webhook Configuration
          </h3>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="display:block;font-size:13px;color:#999;margin-bottom:6px;">Incoming Webhook URL</label>
              <input id="slack-webhook-url" class="input-field" placeholder="https://hooks.slack.com/services/T.../B.../..." style="width:100%;max-width:500px;">
              <div style="font-size:11px;color:#555;margin-top:4px;">Create one at <a href="https://api.slack.com/messaging/webhooks" target="_blank" style="color:#6a4cf5;">api.slack.com/messaging/webhooks</a></div>
            </div>
            <button onclick="saveSlackWebhook()" class="btn-primary" style="width:fit-content;">Save Slack Integration</button>
            <div id="slack-save-msg" style="font-size:12px;color:#22c55e;display:none;">✓ Connected</div>
          </div>
        </div>
      </div>

      <!-- ── API KEYS ──────────────────────────────── -->
      <div id="section-apikeys" class="settings-section" style="display:none;">
        <div class="card" style="padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div>
              <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;">API Keys</h2>
              <p style="font-size:13px;color:#666;">Use these keys to authenticate the embeddable widget</p>
            </div>
            <button onclick="generateApiKey()" class="btn-primary" style="font-size:13px;"><i class="fas fa-plus"></i> Generate Key</button>
          </div>
          <div id="api-keys-list">
            <div style="color:#555;font-size:13px;">Loading API keys…</div>
          </div>
          <div id="new-key-banner" style="display:none;margin-top:16px;padding:16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;">
            <div style="font-size:12px;color:#22c55e;font-weight:600;margin-bottom:8px;">⚠ New API Key — Save it now, it won't be shown again!</div>
            <div id="new-key-text" style="font-family:monospace;font-size:13px;color:#fff;word-break:break-all;margin-bottom:8px;"></div>
            <button onclick="copyNewKey()" class="btn-secondary" style="font-size:12px;">Copy Key</button>
          </div>
        </div>
      </div>

    </div><!-- end panels -->
  </div>

  <!-- Invite Team Member Modal -->
  <div id="invite-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
    <div class="card" style="padding:28px;width:420px;max-width:90vw;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-size:15px;font-weight:600;">Invite Team Member</h3>
        <button onclick="closeInviteModal()" style="background:none;border:none;color:#666;cursor:pointer;font-size:18px;">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;color:#999;display:block;margin-bottom:4px;">First Name</label>
          <input id="invite-fname" class="input-field" placeholder="Jane" style="width:100%;">
        </div>
        <div>
          <label style="font-size:12px;color:#999;display:block;margin-bottom:4px;">Last Name</label>
          <input id="invite-lname" class="input-field" placeholder="Smith" style="width:100%;">
        </div>
        <div>
          <label style="font-size:12px;color:#999;display:block;margin-bottom:4px;">Email</label>
          <input id="invite-email" class="input-field" placeholder="jane@company.com" type="email" style="width:100%;">
        </div>
        <div>
          <label style="font-size:12px;color:#999;display:block;margin-bottom:4px;">Role</label>
          <select id="invite-role" class="input-field" style="width:100%;cursor:pointer;">
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div id="invite-error" style="color:#ef4444;font-size:12px;display:none;"></div>
        <button onclick="inviteMember()" class="btn-primary" style="width:100%;">Send Invitation</button>
        <div id="invite-success" style="font-size:12px;color:#22c55e;display:none;text-align:center;"></div>
      </div>
    </div>
  </div>

  <style>
    .settings-nav-item { color: #666; }
    .settings-nav-item:hover, .settings-nav-item.active { background: #141414 !important; color: #fff !important; }
    .settings-nav-item.active { background: #141414; color: #fff; }
  </style>

  <script>
    // ── State ────────────────────────────────────────
    let currentSettings = {};
    let currentTenant = {};
    let activeSection = 'workspace';
    let allowHumanRequest = true;
    let emailNotifEnabled = false;
    let currentApiKey = '';
    let newlyGeneratedKey = '';

    // ── Navigation ───────────────────────────────────
    function showSection(id) {
      document.querySelectorAll('.settings-section').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
      const sec = document.getElementById('section-' + id);
      if (sec) sec.style.display = 'flex', sec.style.flexDirection = 'column', sec.style.gap = '16px';
      const nav = document.getElementById('nav-' + id);
      if (nav) nav.classList.add('active');
      activeSection = id;
      // Lazy-load section data
      if (id === 'team') loadTeamMembers();
      if (id === 'billing') loadBilling();
      if (id === 'apikeys') loadApiKeys();
    }

    // ── Load settings on mount ───────────────────────
    async function loadSettings() {
      try {
        const res = await authFetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        currentSettings = data.settings || {};
        currentTenant = data.tenant || {};

        // Workspace
        document.getElementById('ws-name').value = currentTenant.name || '';
        const tz = currentSettings.timezone || 'UTC+0';
        const tzSel = document.getElementById('ws-timezone');
        for (let opt of tzSel.options) { if (opt.value === tz) { opt.selected = true; break; } }
        document.getElementById('ws-plan').textContent = (currentTenant.plan || 'free').charAt(0).toUpperCase() + (currentTenant.plan || 'free').slice(1) + ' Plan';

        // AI
        const thresh = Math.round((currentSettings.ai_confidence_threshold || 0.5) * 100);
        document.getElementById('ai-threshold').value = thresh;
        document.getElementById('ai-threshold-val').textContent = thresh + '%';
        document.getElementById('ai-keywords').value = currentSettings.escalation_keywords || '';
        document.getElementById('ai-welcome').value = currentSettings.ai_welcome_message || '';
        allowHumanRequest = currentSettings.allow_human_request !== false;
        updateHumanToggle();

        // Widget
        const color = currentSettings.widget_primary_color || '#6a4cf5';
        document.getElementById('widget-color').value = color;
        document.getElementById('widget-color-hex').value = color;
        document.getElementById('widget-greeting').value = currentSettings.widget_greeting || '';
        document.getElementById('widget-placeholder').value = currentSettings.widget_placeholder || '';
        const pos = currentSettings.widget_position || 'bottom-right';
        const posSel = document.getElementById('widget-position');
        for (let opt of posSel.options) { if (opt.value === pos) { opt.selected = true; break; } }

        // API key display
        currentApiKey = currentSettings.api_key || '';
        const keyDisplay = document.getElementById('api-key-display');
        if (keyDisplay) keyDisplay.textContent = currentApiKey || 'No API key — generate one below';
        updateEmbedPreview();

        // Notifications
        emailNotifEnabled = !!currentSettings.email_notifications;
        updateNotifToggle();
        document.getElementById('notif-email').value = currentSettings.notification_email || '';

      } catch(e) { console.error('Settings load error', e); }
    }

    // ── Workspace save ───────────────────────────────
    async function saveWorkspace() {
      const btn = document.getElementById('save-workspace-btn');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        const res = await authFetch('/api/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            workspace_name: document.getElementById('ws-name').value,
            timezone: document.getElementById('ws-timezone').value,
          })
        });
        if (res.ok) {
          const msg = document.getElementById('ws-save-msg');
          msg.style.display = 'block';
          setTimeout(() => msg.style.display = 'none', 2500);
        }
      } finally { btn.textContent = 'Save Changes'; btn.disabled = false; }
    }

    // ── AI save ──────────────────────────────────────
    async function saveAI() {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          ai_confidence_threshold: parseInt(document.getElementById('ai-threshold').value) / 100,
          escalation_keywords: document.getElementById('ai-keywords').value,
          ai_welcome_message: document.getElementById('ai-welcome').value,
          allow_human_request: allowHumanRequest,
        })
      });
      if (res.ok) {
        const msg = document.getElementById('ai-save-msg');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2500);
      }
    }

    // ── Widget save ──────────────────────────────────
    async function saveWidget() {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          widget_primary_color: document.getElementById('widget-color-hex').value,
          widget_position: document.getElementById('widget-position').value,
          widget_greeting: document.getElementById('widget-greeting').value,
          widget_placeholder: document.getElementById('widget-placeholder').value,
        })
      });
      if (res.ok) {
        const msg = document.getElementById('widget-save-msg');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2500);
      }
    }

    // ── Notifications save ───────────────────────────
    async function saveNotifications() {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          email_notifications: emailNotifEnabled,
          notification_email: document.getElementById('notif-email').value,
        })
      });
      if (res.ok) {
        const msg = document.getElementById('notif-save-msg');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2500);
      }
    }

    // ── Toggles ──────────────────────────────────────
    function toggleHuman() {
      allowHumanRequest = !allowHumanRequest;
      updateHumanToggle();
    }
    function updateHumanToggle() {
      const t = document.getElementById('ai-human-toggle');
      const d = document.getElementById('ai-human-dot');
      if (!t || !d) return;
      t.style.background = allowHumanRequest ? '#22c55e' : '#333';
      d.style.left = allowHumanRequest ? 'auto' : '3px';
      d.style.right = allowHumanRequest ? '3px' : 'auto';
    }
    function toggleNotif() {
      emailNotifEnabled = !emailNotifEnabled;
      updateNotifToggle();
    }
    function updateNotifToggle() {
      const t = document.getElementById('notif-toggle');
      const d = document.getElementById('notif-dot');
      if (!t || !d) return;
      t.style.background = emailNotifEnabled ? '#22c55e' : '#333';
      d.style.left = emailNotifEnabled ? 'auto' : '3px';
      d.style.right = emailNotifEnabled ? '3px' : 'auto';
    }

    // ── Embed preview ────────────────────────────────
    function updateEmbedPreview() {
      const color = document.getElementById('widget-color-hex')?.value || '#6a4cf5';
      const key = currentApiKey || 'YOUR_API_KEY';
      const origin = window.location.origin;
      const code = \`<span style="color:#6a4cf5">&lt;script</span>
  <span style="color:#22c55e">src</span>=<span style="color:#ff7a3d">"\${origin}/api/widget/widget.js"</span>
  <span style="color:#22c55e">data-supportiq-key</span>=<span style="color:#ff7a3d">"\${key}"</span>
  <span style="color:#22c55e">data-color</span>=<span style="color:#ff7a3d">"\${color}"</span>
<span style="color:#6a4cf5">&gt;&lt;/script&gt;</span>\`;
      const el = document.getElementById('embed-preview');
      if (el) el.innerHTML = code;
    }

    function copyEmbed() {
      const color = document.getElementById('widget-color-hex')?.value || '#6a4cf5';
      const key = currentApiKey || 'YOUR_API_KEY';
      const origin = window.location.origin;
      const text = \`<script src="\${origin}/api/widget/widget.js" data-supportiq-key="\${key}" data-color="\${color}"><\\/script>\`;
      navigator.clipboard.writeText(text).then(() => {
        const msg = document.getElementById('copy-msg');
        if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
      });
    }

    // ── API Key generation ───────────────────────────
    async function generateApiKey() {
      if (!confirm('Generate a new API key? Any existing key will continue working.')) return;
      const btn = document.getElementById('gen-key-btn');
      if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }
      try {
        const res = await authFetch('/api/settings/api-key', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.key) {
          newlyGeneratedKey = data.key;
          currentApiKey = data.prefix;
          const keyDisplay = document.getElementById('api-key-display');
          if (keyDisplay) keyDisplay.textContent = data.prefix;
          const reveal = document.getElementById('new-key-reveal');
          if (reveal) {
            reveal.style.display = 'block';
            document.getElementById('new-key-value').textContent = data.key;
          }
          const banner = document.getElementById('new-key-banner');
          if (banner) {
            banner.style.display = 'block';
            document.getElementById('new-key-text').textContent = data.key;
          }
          updateEmbedPreview();
          loadApiKeys();
        } else {
          alert(data.error || 'Failed to generate key');
        }
      } finally {
        if (btn) { btn.textContent = '⚡ Generate New Key'; btn.disabled = false; }
      }
    }

    function copyKey() {
      navigator.clipboard.writeText(newlyGeneratedKey);
      event.target.textContent = '✓ Copied!';
      setTimeout(() => event.target.textContent = 'Copy Key', 2000);
    }
    function copyNewKey() {
      navigator.clipboard.writeText(newlyGeneratedKey);
      event.target.textContent = '✓ Copied!';
      setTimeout(() => event.target.textContent = 'Copy Key', 2000);
    }

    // ── Load team members ────────────────────────────
    async function loadTeamMembers() {
      const el = document.getElementById('team-members-list');
      if (!el) return;
      try {
        const res = await authFetch('/api/settings/team');
        const data = await res.json();
        const team = data.team || [];
        if (!team.length) { el.innerHTML = '<div style="color:#555;font-size:13px;">No team members yet.</div>'; return; }
        const colors = ['#6a4cf5','#d44df0','#0099ff','#22c55e','#ff7a3d'];
        el.innerHTML = team.map((u, i) => {
          const initials = ((u.first_name||'')[0]||'') + ((u.last_name||'')[0]||'');
          const color = colors[i % colors.length];
          return \`<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#1c1c1c;border-radius:10px;margin-bottom:8px;">
            <div style="width:38px;height:38px;background:\${color}22;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:\${color};">\${initials.toUpperCase()||'?'}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:500;">\${u.first_name} \${u.last_name}</div>
              <div style="font-size:11px;color:#666;">\${u.email}</div>
            </div>
            <span style="font-size:11px;background:#6a4cf522;color:#6a4cf5;padding:3px 10px;border-radius:100px;">\${u.role}</span>
            <span style="font-size:11px;background:\${u.is_active ? 'rgba(34,197,94,0.15)' : '#1c1c1c'};color:\${u.is_active ? '#22c55e' : '#555'};padding:3px 10px;border-radius:100px;">\${u.is_active ? 'Active' : 'Inactive'}</span>
          </div>\`;
        }).join('');
      } catch(e) { el.innerHTML = '<div style="color:#555;font-size:13px;">Failed to load team.</div>'; }
    }

    // ── Load billing ─────────────────────────────────
    async function loadBilling() {
      const el = document.getElementById('billing-info');
      if (!el) return;
      try {
        const res = await authFetch('/api/billing/subscription');
        const data = await res.json();
        const sub = data.subscription || {};
        const planColors = { free: '#666', pro: '#6a4cf5', enterprise: '#d44df0' };
        const plan = sub.plan || 'free';
        const color = planColors[plan] || '#666';
        el.innerHTML = \`
          <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#1c1c1c;border-radius:12px;">
            <div style="flex:1;">
              <div style="font-size:12px;color:#666;margin-bottom:2px;">Current Plan</div>
              <div style="font-size:22px;font-weight:700;color:\${color};">\${plan.charAt(0).toUpperCase()+plan.slice(1)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;color:#666;margin-bottom:2px;">Monthly Usage</div>
              <div style="font-size:16px;font-weight:600;">\${sub.conversations_this_month||0} <span style="font-size:12px;color:#555;">/ \${sub.max_conversations||500} convs</span></div>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button onclick="openCheckout('pro')" class="btn-primary" style="font-size:13px;">\${plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro — $49/mo'}</button>
            \${plan !== 'free' ? '<button onclick="openBillingPortal()" class="btn-secondary" style="font-size:13px;">Manage Billing</button>' : ''}
          </div>
        \`;
      } catch(e) { el.innerHTML = '<div style="color:#555;font-size:13px;">Failed to load billing info.</div>'; }
    }

    async function openCheckout(plan) {
      try {
        const res = await authFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else alert(data.error || data.message || 'Checkout unavailable');
      } catch(e) { alert('Failed to open checkout'); }
    }

    async function openBillingPortal() {
      try {
        const res = await authFetch('/api/billing/portal', { method: 'POST' });
        const data = await res.json();
        if (data.url) window.open(data.url, '_blank');
        else alert(data.error || data.message || 'Portal unavailable');
      } catch(e) { alert('Failed to open billing portal'); }
    }

    // ── Load API keys list ───────────────────────────
    async function loadApiKeys() {
      const el = document.getElementById('api-keys-list');
      if (!el) return;
      // We show the prefix from settings for now (single key per tenant)
      const key = currentApiKey || currentSettings?.api_key;
      if (!key) {
        el.innerHTML = '<div style="color:#555;font-size:13px;">No API keys yet. Generate one to get started.</div>';
        return;
      }
      el.innerHTML = \`<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#1c1c1c;border-radius:10px;">
        <i class="fas fa-key" style="color:#6a4cf5;font-size:16px;"></i>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;">Default API Key</div>
          <div style="font-family:monospace;font-size:12px;color:#666;">\${key}••••••••••••</div>
        </div>
        <span style="font-size:11px;background:rgba(34,197,94,0.15);color:#22c55e;padding:3px 10px;border-radius:100px;">Active</span>
      </div>\`;
    }

    // ── Invite modal ─────────────────────────────────
    function showInviteModal() {
      document.getElementById('invite-modal').style.display = 'flex';
    }
    function closeInviteModal() {
      document.getElementById('invite-modal').style.display = 'none';
      document.getElementById('invite-error').style.display = 'none';
      document.getElementById('invite-success').style.display = 'none';
    }
    async function inviteMember() {
      const body = {
        first_name: document.getElementById('invite-fname').value,
        last_name: document.getElementById('invite-lname').value,
        email: document.getElementById('invite-email').value,
        role: document.getElementById('invite-role').value,
      };
      if (!body.email || !body.first_name) {
        document.getElementById('invite-error').textContent = 'First name and email are required';
        document.getElementById('invite-error').style.display = 'block';
        return;
      }
      try {
        const res = await authFetch('/api/settings/team/invite', { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
          const msg = \`\${body.email} added successfully!\${data.temp_password ? ' Temp password: ' + data.temp_password : ''}\`;
          document.getElementById('invite-success').textContent = msg;
          document.getElementById('invite-success').style.display = 'block';
          document.getElementById('invite-error').style.display = 'none';
          loadTeamMembers();
          setTimeout(closeInviteModal, 3000);
        } else {
          document.getElementById('invite-error').textContent = data.error || 'Invite failed';
          document.getElementById('invite-error').style.display = 'block';
        }
      } catch(e) { document.getElementById('invite-error').textContent = 'Network error'; document.getElementById('invite-error').style.display = 'block'; }
    }

    // ── Integrations ─────────────────────────────────
    function connectIntegration(name) {
      if (name === 'Slack') {
        document.getElementById('slack-config').style.display = 'block';
        document.getElementById('slack-config').scrollIntoView({ behavior: 'smooth' });
      } else {
        alert(name + ' integration coming soon!');
      }
    }
    async function saveSlackWebhook() {
      const url = document.getElementById('slack-webhook-url').value.trim();
      if (!url.startsWith('https://hooks.slack.com/')) {
        alert('Please enter a valid Slack Incoming Webhook URL');
        return;
      }
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ slack_webhook_url: url })
      });
      if (res.ok) {
        const msg = document.getElementById('slack-save-msg');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2500);
      }
    }

    // ── Init ─────────────────────────────────────────
    showSection('workspace');
    loadSettings();
  </script>`
}

function getWidgetDemoHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Demo — SupportIQ</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f0f0f5; font-family: 'Inter', sans-serif; min-height: 100vh; }
    .demo-site { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    .demo-header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 20px 28px; display: flex; gap: 16px; align-items: center; border-radius: 14px; margin-bottom: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    .demo-card { background: white; border-radius: 14px; padding: 32px; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .faq-item { border-bottom: 1px solid #f0f0f0; padding: 14px 0; cursor: pointer; }
    .faq-item:last-child { border-bottom: none; }
    .faq-q { font-size: 14px; font-weight: 500; color: #222; display: flex; justify-content: space-between; align-items: center; }
    .faq-q:after { content: '+'; color: #6a4cf5; font-size: 18px; }
  </style>
</head>
<body>

<!-- Demo website content -->
<div class="demo-site">

  <!-- Info banner -->
  <div style="background: #1a1a2e; color: #aaa; padding: 10px 18px; border-radius: 10px; font-size: 12px; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
    <i class="fas fa-circle-info" style="color: #6a4cf5; font-size: 14px;"></i>
    <span>This page demonstrates the <strong style="color:#fff;">SupportIQ</strong> chat widget embedded on a customer website. The widget loads from <code style="background:#262626;padding:2px 6px;border-radius:4px;color:#d44df0;">/api/widget/widget.js</code> — click the button in the bottom-right! 
    </span>
    <a href="/dashboard" style="margin-left: auto; color: #6a4cf5; text-decoration: none; white-space: nowrap; font-weight: 500;">← Dashboard</a>
  </div>

  <!-- Mock company header -->
  <div class="demo-header">
    <div style="width: 44px; height: 44px; background: rgba(106,76,245,0.3); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
      <i class="fas fa-store" style="font-size: 20px; color: #a982cf;"></i>
    </div>
    <div style="flex: 1;">
      <div style="font-size: 18px; font-weight: 700;">Acme Corp — Help Center</div>
      <div style="font-size: 13px; opacity: 0.55; margin-top: 2px;">Documentation, tutorials and support</div>
    </div>
    <div style="display: flex; gap: 20px; font-size: 13px; opacity: 0.6;">
      <span>Docs</span><span>API</span><span>Community</span>
    </div>
  </div>

  <!-- Getting started -->
  <div class="demo-card">
    <h1 style="font-size: 22px; font-weight: 700; color: #111; margin-bottom: 8px;">Getting Started with Acme Corp</h1>
    <p style="color: #666; line-height: 1.7; margin-bottom: 24px; font-size: 14px;">Welcome! This guide covers everything you need to set up your account and start building with the Acme platform in minutes.</p>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      ${['📦 Account Setup', '🔌 API Integration', '💳 Billing & Plans', '🛠 Troubleshooting'].map(t => `
      <div style="border: 1.5px solid #eee; border-radius: 12px; padding: 18px; cursor: pointer; transition: border-color 0.15s;" onmouseover="this.style.borderColor='#6a4cf5'" onmouseout="this.style.borderColor='#eee'">
        <div style="font-size: 15px; font-weight: 600; color: #111; margin-bottom: 5px;">${t}</div>
        <div style="font-size: 13px; color: #888; line-height: 1.5;">Step-by-step walkthrough →</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- FAQ -->
  <div class="demo-card">
    <h2 style="font-size: 17px; font-weight: 700; color: #111; margin-bottom: 16px;">Frequently Asked Questions</h2>
    ${[
      'How do I reset my password?',
      'What payment methods do you accept?',
      'How does API rate limiting work?',
      'Can I export my data?',
      'How do I add team members?'
    ].map(q => `
    <div class="faq-item">
      <div class="faq-q">${q}</div>
    </div>`).join('')}
  </div>

  <!-- CTA -->
  <div class="demo-card" style="background: linear-gradient(135deg, #6a4cf520, #d44df015); border: 1px solid #6a4cf530; text-align: center;">
    <div style="font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px;">Can't find what you're looking for?</div>
    <p style="color: #666; font-size: 14px; margin-bottom: 16px;">Our AI support assistant can answer most questions instantly. Just click the chat button in the bottom-right corner!</p>
    <div style="font-size: 12px; color: #888;">Powered by <span style="color: #6a4cf5; font-weight: 600;">SupportIQ AI</span> · Average response time &lt; 5 seconds</div>
  </div>

</div>

<!--
  ╔══════════════════════════════════════════════════════════╗
  ║  REAL WIDGET EMBED — loaded from /api/widget/widget.js  ║
  ║  The script tag below is all you need on your website.  ║
  ╚══════════════════════════════════════════════════════════╝

  NOTE: data-supportiq-key must be a real API key generated
  in Settings → Widget Design → API Key.
  For this demo page we load config dynamically from the server.
-->
<script id="supportiq-demo-loader">
  // In the real embed, the user puts their API key directly:
  // <script src="..." data-supportiq-key="sk_live_YOUR_KEY" ...><\/script>
  //
  // For the demo page we fetch the workspace key from the API
  // so it works without hardcoding anything.
  (async function() {
    try {
      const token = localStorage.getItem('siq_token');
      if (!token) {
        // No session — load widget with a placeholder key so the UI still shows
        loadWidget('DEMO_KEY');
        return;
      }
      const res = await fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        const key = (data.settings && data.settings.api_key) || 'DEMO_KEY';
        loadWidget(key);
      } else {
        loadWidget('DEMO_KEY');
      }
    } catch(e) {
      loadWidget('DEMO_KEY');
    }
  })();

  function loadWidget(apiKey) {
    const script = document.createElement('script');
    script.src = '/api/widget/widget.js';
    script.setAttribute('data-supportiq-key', apiKey);
    script.setAttribute('data-color', '#6a4cf5');
    document.body.appendChild(script);
  }
</script>

</body>
</html>`
}

export default app
