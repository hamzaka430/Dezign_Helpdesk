import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import ticketRoutes from './routes/tickets'
import knowledgeRoutes from './routes/knowledge'
import conversationRoutes from './routes/conversations'
import settingsRoutes from './routes/settings'
import statsRoutes from './routes/stats'
import type { Env } from './lib/middleware'

const app = new Hono<{ Bindings: Env }>()

// ---- CORS --------------------------------------------------
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
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
  version: '1.1.0',
  db: c.env.DB ? 'connected' : 'not_configured',
  storage: c.env.STORAGE ? 'connected' : 'not_configured',
  timestamp: new Date().toISOString()
}))

// ---- API Routes (Real — Phase 1) ---------------------------
app.route('/api/auth', authRoutes)
app.route('/api/tickets', ticketRoutes)
app.route('/api/knowledge-bases', knowledgeRoutes)
app.route('/api/conversations', conversationRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/stats', statsRoutes)

// ---- Legacy /api/chat (Phase 2 will replace with real RAG) -
app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { message, conversation_id } = body

  // Phase 2: replace with real OpenAI + Qdrant RAG
  await new Promise(r => setTimeout(r, 400))

  const responses = [
    { content: "I found this in our documentation: The password reset process takes 5-10 minutes. Check your spam folder if you don't receive the email. You can also try the 'Magic Link' login option.", confidence: 0.92, sources: ['Password Reset Guide', 'Account Settings FAQ'] },
    { content: "Based on our knowledge base, billing charges are processed on the 1st of each month. If you see a discrepancy, please provide your invoice number and I'll help resolve it.", confidence: 0.87, sources: ['Billing FAQ'] },
    { content: "I wasn't able to find a specific answer to your question in our knowledge base. Let me connect you with a human agent who can better assist you.", confidence: 0.23, sources: [], escalate: true },
  ]

  const response = message.toLowerCase().includes('billing') ? responses[1] :
    message.toLowerCase().includes('password') ? responses[0] : responses[2]

  // If conversation_id given and DB available, persist the messages
  if (conversation_id && c.env.DB) {
    try {
      const { DB: db_lib } = await import('./lib/db')
      const { generateId } = await import('./lib/auth')
      const db = new db_lib(c.env.DB)
      await db.createMessage({
        id: generateId('msg'), conversation_id,
        tenant_id: 'tenant_demo_001',
        sender_type: 'customer', content: message
      })
      await db.createMessage({
        id: generateId('msg'), conversation_id,
        tenant_id: 'tenant_demo_001',
        sender_type: 'ai', content: response.content,
        confidence: response.confidence,
        sources: (response as any).sources || [],
        escalate: (response as any).escalate || false
      })
    } catch (e) { /* non-fatal */ }
  }

  return c.json(response)
})

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
  <div style="margin-bottom: 28px;">
    <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Overview</h1>
    <p style="font-size: 14px; color: #666;">Welcome back, Alex. Here's what's happening today.</p>
  </div>
  
  <!-- Stats -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
    <div class="card stat-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 36px; height: 36px; background: rgba(106,76,245,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-ticket" style="color: #6a4cf5; font-size: 14px;"></i>
        </div>
        <span style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 11px; padding: 3px 8px; border-radius: 100px;">↑ 12%</span>
      </div>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: -1px;">1,284</div>
      <div style="font-size: 13px; color: #666; margin-top: 2px;">Total Tickets</div>
    </div>
    
    <div class="card stat-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 36px; height: 36px; background: rgba(34,197,94,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-robot" style="color: #22c55e; font-size: 14px;"></i>
        </div>
        <span style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 11px; padding: 3px 8px; border-radius: 100px;">↑ 4.2%</span>
      </div>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: -1px;">78.4%</div>
      <div style="font-size: 13px; color: #666; margin-top: 2px;">AI Resolution Rate</div>
    </div>
    
    <div class="card stat-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 36px; height: 36px; background: rgba(0,153,255,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-clock" style="color: #0099ff; font-size: 14px;"></i>
        </div>
        <span style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 11px; padding: 3px 8px; border-radius: 100px;">↓ 18%</span>
      </div>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: -1px;">2m 34s</div>
      <div style="font-size: 13px; color: #666; margin-top: 2px;">Avg Response Time</div>
    </div>
    
    <div class="card stat-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 36px; height: 36px; background: rgba(255,122,61,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-star" style="color: #ff7a3d; font-size: 14px;"></i>
        </div>
        <span style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 11px; padding: 3px 8px; border-radius: 100px;">↑ 0.3</span>
      </div>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: -1px;">4.7★</div>
      <div style="font-size: 13px; color: #666; margin-top: 2px;">CSAT Score</div>
    </div>
  </div>
  
  <!-- Charts Row -->
  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div class="card" style="padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 15px; font-weight: 600;">Ticket Volume</h2>
        <select style="background: #1c1c1c; border: 1px solid #262626; border-radius: 8px; padding: 6px 12px; color: #999; font-size: 12px; outline: none; cursor: pointer;">
          <option>Last 12 months</option>
          <option>Last 30 days</option>
          <option>Last 7 days</option>
        </select>
      </div>
      <div style="height: 200px;"><canvas id="volumeChart"></canvas></div>
    </div>
    
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Resolution Breakdown</h2>
      <div style="height: 160px;"><canvas id="aiChart"></canvas></div>
    </div>
  </div>
  
  <!-- Recent Tickets -->
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 16px;">
      <h2 style="font-size: 15px; font-weight: 600;">Recent Tickets</h2>
      <a href="/dashboard/tickets" style="font-size: 13px; color: #0099ff; text-decoration: none;">View all →</a>
    </div>
    
    <div class="ticket-row" onclick="window.location.href='/dashboard/inbox'">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #ff5577, #ff7a3d); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">SK</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500;">Unable to reset password</div>
        <div style="font-size: 12px; color: #666;">Sarah K. • 2h ago</div>
      </div>
      <span class="badge badge-urgent">Urgent</span>
      <span class="badge badge-open" style="margin-left: 8px;">Open</span>
    </div>
    
    <div class="ticket-row" onclick="window.location.href='/dashboard/inbox'">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">JR</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500;">Billing charge discrepancy</div>
        <div style="font-size: 12px; color: #666;">James R. • 3h ago</div>
      </div>
      <span class="badge badge-high">High</span>
      <span class="badge badge-progress" style="margin-left: 8px;">In Progress</span>
    </div>
    
    <div class="ticket-row" onclick="window.location.href='/dashboard/inbox'">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #0099ff, #6a4cf5); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">DC</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500;">API integration help needed</div>
        <div style="font-size: 12px; color: #666;">Dev Corp • 5h ago</div>
      </div>
      <span class="badge badge-medium">Medium</span>
      <span class="badge badge-open" style="margin-left: 8px;">Open</span>
    </div>
    
    <div class="ticket-row" onclick="window.location.href='/dashboard/inbox'">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #22c55e, #0099ff); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">ET</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500;">Feature request: dark mode</div>
        <div style="font-size: 12px; color: #666;">Emily T. • 1d ago</div>
      </div>
      <span class="badge badge-low">Low</span>
      <span class="badge badge-resolved" style="margin-left: 8px;">Resolved</span>
    </div>
  </div>`
}

function getInboxContent(): string {
  return `
  <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Inbox</h1>
      <p style="font-size: 14px; color: #666;">12 unread conversations</p>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn-secondary"><i class="fas fa-filter"></i> Filter</button>
      <button class="btn-primary"><i class="fas fa-plus"></i> New Ticket</button>
    </div>
  </div>
  
  <div style="display: grid; grid-template-columns: 320px 1fr; gap: 16px; height: calc(100vh - 180px);">
    <!-- Conversation list -->
    <div class="card" style="overflow-y: auto;">
      <!-- Tabs -->
      <div style="display: flex; border-bottom: 1px solid #1a1a1a; padding: 4px;">
        <button onclick="setTab(this, 'all')" style="flex: 1; background: #1c1c1c; border: none; color: #fff; padding: 8px; font-size: 12px; cursor: pointer; border-radius: 6px; font-family: inherit;">All (12)</button>
        <button onclick="setTab(this, 'ai')" style="flex: 1; background: none; border: none; color: #666; padding: 8px; font-size: 12px; cursor: pointer; border-radius: 6px; font-family: inherit;">AI Chats</button>
        <button onclick="setTab(this, 'escalated')" style="flex: 1; background: none; border: none; color: #666; padding: 8px; font-size: 12px; cursor: pointer; border-radius: 6px; font-family: inherit;">Escalated</button>
      </div>
      
      <!-- Conversations -->
      ${['Sarah K.', 'James R.', 'Dev Corp', 'Emily T.', 'TechStart', 'Mike Chen', 'Diana P.', 'Robert L.'].map((name, i) => {
        const statuses = ['AI → Human', 'Escalated', 'AI Chat', 'AI Chat', 'Escalated', 'AI Chat', 'AI Chat', 'Resolved']
        const times = ['2m ago', '15m ago', '1h ago', '2h ago', '3h ago', '5h ago', '1d ago', '2d ago']
        const previews = [
          "I still haven't received the reset email...",
          "This charge doesn't match my invoice",
          "The API endpoint returns 401 error",
          "Can you add dark mode?",
          "Need to export all data ASAP",
          "Integration with Zapier?",
          "How do I upgrade my plan?",
          "Thank you for your help!"
        ]
        const unread = i < 3
        return `
        <div onclick="loadConversation('${name}')" style="padding: 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.15s; ${i === 0 ? 'background: #141414; border-left: 2px solid #6a4cf5;' : ''}" onmouseover="this.style.background='#141414'" onmouseout="this.style.background='${i === 0 ? '#141414' : 'transparent'}'">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, hsl(${i * 40}, 70%, 60%), hsl(${i * 40 + 60}, 70%, 50%)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">${name.slice(0,2)}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: ${unread ? '600' : '400'};">${name}</span>
                <span style="font-size: 11px; color: #555;">${times[i]}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">${previews[i]}</span>
                ${unread ? '<div style="width: 8px; height: 8px; background: #6a4cf5; border-radius: 50%; flex-shrink: 0;"></div>' : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <span style="font-size: 10px; background: rgba(106,76,245,0.15); color: #6a4cf5; padding: 2px 8px; border-radius: 100px;">${statuses[i]}</span>
          </div>
        </div>`
      }).join('')}
    </div>
    
    <!-- Chat panel -->
    <div class="card" style="display: flex; flex-direction: column; overflow: hidden;">
      <!-- Chat header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #ff5577, #ff7a3d); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;">SK</div>
        <div>
          <div style="font-size: 14px; font-weight: 600;">Sarah K.</div>
          <div style="font-size: 12px; color: #666;">sarah.k@example.com • TKT-1042</div>
        </div>
        <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-urgent">Urgent</span>
          <button class="btn-primary" style="font-size: 12px; padding: 7px 14px;"><i class="fas fa-user-check"></i> Assign to me</button>
          <button style="background: none; border: 1px solid #262626; border-radius: 100px; color: #666; padding: 7px 12px; font-size: 12px; cursor: pointer;"><i class="fas fa-ellipsis-h"></i></button>
        </div>
      </div>
      
      <!-- Context panel -->
      <div style="padding: 10px 20px; background: rgba(106,76,245,0.08); border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 12px; color: #999;"><i class="fas fa-robot" style="color: #6a4cf5; margin-right: 4px;"></i> AI Conversation → Human Handoff</div>
        <div style="font-size: 12px; color: #999;"><i class="fas fa-clock" style="margin-right: 4px;"></i> SLA: <span style="color: #ff5577;">2h 14m remaining</span></div>
        <div style="font-size: 12px; color: #999;"><i class="fas fa-layer-group" style="margin-right: 4px;"></i> KB: Product Docs</div>
      </div>
      
      <!-- Messages -->
      <div style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;" id="chat-messages">
        <!-- AI messages -->
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; margin-top: 2px;"><i class="fas fa-bolt" style="color: white;"></i></div>
          <div>
            <div class="msg-ai">
              <div style="font-size: 11px; color: #6a4cf5; margin-bottom: 4px; font-weight: 600;">SupportIQ AI</div>
              <div style="font-size: 13px; line-height: 1.6; color: #ccc;">Hi Sarah! I'm the AI assistant. I can see you're having trouble with your password reset. Let me help you with that! 👋</div>
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 4px;">2:14 PM</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; align-items: flex-start; flex-direction: row-reverse;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #ff5577, #ff7a3d); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px;">SK</div>
          <div>
            <div class="msg-customer">
              <div style="font-size: 13px; line-height: 1.6; color: #ccc;">Hi, I requested a password reset 30 minutes ago but still haven't received the email.</div>
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 4px; text-align: right;">2:15 PM</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; margin-top: 2px;"><i class="fas fa-bolt" style="color: white;"></i></div>
          <div>
            <div class="msg-ai">
              <div style="font-size: 11px; color: #6a4cf5; margin-bottom: 4px; font-weight: 600;">SupportIQ AI</div>
              <div style="font-size: 13px; line-height: 1.6; color: #ccc;">Password reset emails are sent within 5 minutes. Please check: (1) Your spam/junk folder, (2) That you entered the correct email address. You can also use <span style="color: #0099ff;">Magic Link login</span> as an alternative. Would you like me to resend the email?</div>
              <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 10px; color: #6a4cf5; background: rgba(106,76,245,0.2); padding: 2px 8px; border-radius: 100px; border: 1px solid rgba(106,76,245,0.3); cursor: pointer;">📄 Account FAQ</span>
                <span style="font-size: 10px; color: #666; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 100px;">Confidence: 89%</span>
              </div>
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 4px;">2:15 PM</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; align-items: flex-start; flex-direction: row-reverse;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #ff5577, #ff7a3d); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px;">SK</div>
          <div>
            <div class="msg-customer">
              <div style="font-size: 13px; line-height: 1.6; color: #ccc;">I've checked spam too. Nothing there. I need to access my account urgently. Can I speak to a human agent please?</div>
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 4px; text-align: right;">2:22 PM</div>
          </div>
        </div>
        
        <!-- Handoff notice -->
        <div style="display: flex; justify-content: center;">
          <div style="background: rgba(106,76,245,0.15); border: 1px solid rgba(106,76,245,0.3); border-radius: 100px; padding: 6px 16px; font-size: 12px; color: #6a4cf5;">
            <i class="fas fa-arrow-right" style="margin-right: 4px;"></i> Transferred to human agent
          </div>
        </div>
        
        <!-- Typing -->
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #22c55e, #0099ff); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px;">AM</div>
          <div>
            <div style="background: #1c1c1c; border-radius: 12px; padding: 12px 16px; display: flex; gap: 4px; align-items: center; width: fit-content;">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 4px;">Alex is typing...</div>
          </div>
        </div>
      </div>
      
      <!-- Reply box -->
      <div style="padding: 16px 20px; border-top: 1px solid #1a1a1a;">
        <!-- Canned responses -->
        <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
          <button onclick="insertCanned('I apologize for the inconvenience. Let me check this for you right away.')" style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 4px 12px; font-size: 11px; color: #999; cursor: pointer;">👋 Greeting</button>
          <button onclick="insertCanned('I have escalated this to our technical team. You will hear back within 2 hours.')" style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 4px 12px; font-size: 11px; color: #999; cursor: pointer;">⬆️ Escalate</button>
          <button onclick="insertCanned('Your issue has been resolved. Please let me know if you need anything else!')" style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 4px 12px; font-size: 11px; color: #999; cursor: pointer;">✅ Resolved</button>
        </div>
        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <textarea id="reply-input" placeholder="Reply to Sarah..." style="flex: 1; background: #1c1c1c; border: 1px solid #262626; border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none; resize: none; min-height: 80px; font-family: inherit;" onfocus="this.style.borderColor='rgba(0,153,255,0.4)'" onblur="this.style.borderColor='#262626'"></textarea>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button style="background: none; border: 1px solid #262626; border-radius: 8px; width: 36px; height: 36px; color: #666; cursor: pointer;" title="Add note"><i class="fas fa-sticky-note"></i></button>
            <button onclick="sendReply()" class="btn-primary" style="border-radius: 8px; padding: 10px 16px; width: auto;"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    function setTab(btn, tab) {
      document.querySelectorAll('.tab-btn').forEach(b => { b.style.background = 'none'; b.style.color = '#666'; });
    }
    function loadConversation(name) {}
    function insertCanned(text) { document.getElementById('reply-input').value = text; }
    function sendReply() {
      const input = document.getElementById('reply-input');
      if (!input.value.trim()) return;
      input.value = '';
    }
  </script>`
}

function getTicketsContent(): string {
  return `
  <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
    <div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Tickets</h1>
      <p style="font-size: 14px; color: #666;">47 open tickets</p>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <select style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 8px 16px; color: #999; font-size: 13px; outline: none; cursor: pointer; font-family: inherit;">
        <option>All Status</option>
        <option>Open</option>
        <option>In Progress</option>
        <option>Resolved</option>
      </select>
      <select style="background: #1c1c1c; border: 1px solid #262626; border-radius: 100px; padding: 8px 16px; color: #999; font-size: 13px; outline: none; cursor: pointer; font-family: inherit;">
        <option>All Priority</option>
        <option>Urgent</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
      <button class="btn-primary"><i class="fas fa-plus"></i> New Ticket</button>
    </div>
  </div>
  
  <div class="card">
    <!-- Table header -->
    <div style="display: grid; grid-template-columns: 100px 1fr 120px 100px 120px 140px 80px; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #1a1a1a; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">
      <div>ID</div>
      <div>Subject</div>
      <div>Customer</div>
      <div>Priority</div>
      <div>Status</div>
      <div>Assignee</div>
      <div>Created</div>
    </div>
    
    ${[
      { id: 'TKT-1042', subject: 'Unable to reset password', customer: 'Sarah K.', priority: 'urgent', status: 'open', assignee: 'Alex M.', created: '2h ago' },
      { id: 'TKT-1041', subject: 'Billing charge discrepancy', customer: 'James R.', priority: 'high', status: 'in_progress', assignee: 'Maria L.', created: '3h ago' },
      { id: 'TKT-1040', subject: 'API integration 401 error', customer: 'Dev Corp', priority: 'medium', status: 'open', assignee: null, created: '5h ago' },
      { id: 'TKT-1039', subject: 'Feature request: dark mode', customer: 'Emily T.', priority: 'low', status: 'resolved', assignee: 'Alex M.', created: '1d ago' },
      { id: 'TKT-1038', subject: 'Export data to CSV', customer: 'TechStart', priority: 'medium', status: 'in_progress', assignee: 'Jordan B.', created: '1d ago' },
      { id: 'TKT-1037', subject: 'SSO configuration help', customer: 'Enterprise Co', priority: 'high', status: 'open', assignee: null, created: '2d ago' },
      { id: 'TKT-1036', subject: 'Mobile app crashes on login', customer: 'Mike Chen', priority: 'urgent', status: 'in_progress', assignee: 'Maria L.', created: '2d ago' },
      { id: 'TKT-1035', subject: 'Webhook not firing', customer: 'Webhook Inc', priority: 'medium', status: 'resolved', assignee: 'Jordan B.', created: '3d ago' },
    ].map(t => `
    <div style="display: grid; grid-template-columns: 100px 1fr 120px 100px 120px 140px 80px; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.15s; align-items: center; font-size: 13px;" onmouseover="this.style.background='#141414'" onmouseout="this.style.background='transparent'" onclick="window.location.href='/dashboard/inbox'">
      <div style="font-family: monospace; color: #666; font-size: 12px;">${t.id}</div>
      <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.subject}</div>
      <div style="color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.customer}</div>
      <div><span class="badge badge-${t.priority}">${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</span></div>
      <div><span class="badge badge-${t.status === 'in_progress' ? 'progress' : t.status}">${t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span></div>
      <div style="color: #999; font-size: 12px;">${t.assignee || '<span style="color: #555;">Unassigned</span>'}</div>
      <div style="color: #555; font-size: 12px;">${t.created}</div>
    </div>`).join('')}
  </div>`
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
  <div style="margin-bottom: 28px;">
    <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Analytics</h1>
    <p style="font-size: 14px; color: #666;">AI performance and support metrics</p>
  </div>
  
  <!-- Top metrics -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
    ${[
      { icon: 'robot', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'AI Resolution Rate', value: '78.4%', delta: '+4.2%' },
      { icon: 'clock', color: '#0099ff', bg: 'rgba(0,153,255,0.15)', label: 'Avg First Response', value: '1.2s', delta: '-67%' },
      { icon: 'star', color: '#ff7a3d', bg: 'rgba(255,122,61,0.15)', label: 'CSAT Score', value: '4.7/5', delta: '+0.3' },
      { icon: 'exclamation-triangle', color: '#ff5577', bg: 'rgba(255,85,119,0.15)', label: 'Escalation Rate', value: '21.6%', delta: '-2.1%' },
    ].map(m => `
    <div class="card stat-card">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <div style="width: 36px; height: 36px; background: ${m.bg}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-${m.icon}" style="color: ${m.color}; font-size: 14px;"></i>
        </div>
        <span style="font-size: 12px; color: #22c55e;">${m.delta}</span>
      </div>
      <div style="font-size: 26px; font-weight: 700; letter-spacing: -1px;">${m.value}</div>
      <div style="font-size: 13px; color: #666; margin-top: 2px;">${m.label}</div>
    </div>`).join('')}
  </div>
  
  <!-- Charts -->
  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Ticket Volume & AI Resolution</h2>
      <div style="height: 220px;"><canvas id="volumeChart"></canvas></div>
    </div>
    <div class="card" style="padding: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Resolution Breakdown</h2>
      <div style="height: 160px; margin-bottom: 12px;"><canvas id="aiChart"></canvas></div>
    </div>
  </div>
  
  <!-- AI Gap Analysis -->
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 15px; font-weight: 600;">Knowledge Gap Analysis</h2>
        <p style="font-size: 13px; color: #666; margin-top: 2px;">Queries AI couldn't answer — add to knowledge base</p>
      </div>
      <button class="btn-secondary" style="font-size: 12px;"><i class="fas fa-download"></i> Export</button>
    </div>
    
    ${[
      { query: 'How do I integrate with Salesforce CRM?', count: 23, action: 'Add to KB' },
      { query: 'What is the data retention policy?', count: 18, action: 'Add to KB' },
      { query: 'Can I get a refund after 30 days?', count: 14, action: 'Add to KB' },
      { query: 'How to set up SSO with Okta?', count: 11, action: 'Add to KB' },
      { query: 'Is there an offline mode available?', count: 8, action: 'Add to KB' },
    ].map(gap => `
    <div style="display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #1a1a1a;">
      <div style="width: 8px; height: 8px; background: #ff7a3d; border-radius: 50%; flex-shrink: 0;"></div>
      <div style="flex: 1; font-size: 13px; color: #ccc;">"${gap.query}"</div>
      <div style="font-size: 12px; color: #666; min-width: 60px; text-align: right;">${gap.count} times</div>
      <button style="background: rgba(106,76,245,0.15); color: #6a4cf5; border: 1px solid rgba(106,76,245,0.3); border-radius: 100px; padding: 4px 12px; font-size: 12px; cursor: pointer; white-space: nowrap;">${gap.action}</button>
    </div>`).join('')}
  </div>
  
  <!-- Agent performance -->
  <div class="card" style="padding: 24px;">
    <h2 style="font-size: 15px; font-weight: 600; margin-bottom: 20px;">Agent Performance</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      ${[
        { name: 'Alex Morgan', tickets: 48, rating: 4.9, time: '1m 45s', color: '#6a4cf5' },
        { name: 'Maria Lopez', tickets: 61, rating: 4.7, time: '2m 12s', color: '#d44df0' },
        { name: 'Jordan B.', tickets: 35, rating: 4.6, time: '2m 58s', color: '#0099ff' },
      ].map(a => `
      <div style="background: #1c1c1c; border-radius: 12px; padding: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
          <div style="width: 36px; height: 36px; background: ${a.color}33; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: ${a.color};">${a.name.split(' ').map(n => n[0]).join('')}</div>
          <div>
            <div style="font-size: 13px; font-weight: 500;">${a.name}</div>
            <div style="font-size: 11px; color: #666;">Support Agent</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
          <div><div style="font-size: 16px; font-weight: 700;">${a.tickets}</div><div style="font-size: 10px; color: #555;">Tickets</div></div>
          <div><div style="font-size: 16px; font-weight: 700;">${a.rating}★</div><div style="font-size: 10px; color: #555;">CSAT</div></div>
          <div><div style="font-size: 16px; font-weight: 700;">${a.time}</div><div style="font-size: 10px; color: #555;">Avg</div></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`
}

function getSettingsContent(): string {
  return `
  <div style="margin-bottom: 28px;">
    <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 4px;">Settings</h1>
    <p style="font-size: 14px; color: #666;">Manage your workspace and AI configuration</p>
  </div>
  
  <div style="display: grid; grid-template-columns: 200px 1fr; gap: 24px;">
    <!-- Settings nav -->
    <div>
      ${[
        { icon: 'building', label: 'Workspace', active: true },
        { icon: 'robot', label: 'AI Settings', active: false },
        { icon: 'palette', label: 'Widget Design', active: false },
        { icon: 'users', label: 'Team & Roles', active: false },
        { icon: 'bell', label: 'Notifications', active: false },
        { icon: 'credit-card', label: 'Billing', active: false },
        { icon: 'plug', label: 'Integrations', active: false },
        { icon: 'key', label: 'API Keys', active: false },
      ].map(s => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 2px; background: ${s.active ? '#141414' : 'transparent'}; color: ${s.active ? '#fff' : '#666'}; font-size: 13px; transition: all 0.15s;" onmouseover="this.style.background='#141414'; this.style.color='#fff'" onmouseout="this.style.background='${s.active ? '#141414' : 'transparent'}'; this.style.color='${s.active ? '#fff' : '#666'}'">
        <i class="fas fa-${s.icon}" style="width: 16px; text-align: center;"></i> ${s.label}
      </div>`).join('')}
    </div>
    
    <!-- Settings content -->
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Workspace -->
      <div class="card" style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 20px;">Workspace Settings</h2>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">Workspace Name</label>
            <input class="input-field" value="Acme Corp" style="width: 100%; max-width: 400px;">
          </div>
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">Subdomain</label>
            <div style="display: flex; align-items: center; gap: 0; max-width: 400px;">
              <input class="input-field" value="acme" style="flex: 1; border-radius: 8px 0 0 8px;">
              <div style="background: #1c1c1c; border: 1px solid #262626; border-left: none; border-radius: 0 8px 8px 0; padding: 9px 14px; color: #555; font-size: 13px; white-space: nowrap;">.supportiq.io</div>
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">Timezone</label>
            <select class="input-field" style="max-width: 400px; cursor: pointer;">
              <option>UTC-5 Eastern Time</option>
              <option>UTC-8 Pacific Time</option>
              <option>UTC+0 GMT</option>
              <option>UTC+1 CET</option>
            </select>
          </div>
          <button class="btn-primary" style="width: fit-content;">Save Changes</button>
        </div>
      </div>
      
      <!-- AI Settings -->
      <div class="card" style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">AI Configuration</h2>
        <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Configure how the AI assistant responds to customers</p>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">Confidence Threshold for Escalation</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="range" min="0" max="100" value="70" style="flex: 1; max-width: 300px; accent-color: #6a4cf5;" id="threshold-slider" oninput="document.getElementById('threshold-val').textContent = this.value + '%'">
              <span style="font-size: 14px; font-weight: 600; min-width: 40px;" id="threshold-val">70%</span>
            </div>
            <div style="font-size: 12px; color: #555; margin-top: 4px;">AI will escalate to human when confidence is below this threshold</div>
          </div>
          
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">Escalation Keywords</label>
            <input class="input-field" value="refund, cancel, angry, lawsuit, urgent" style="width: 100%; max-width: 400px;">
            <div style="font-size: 12px; color: #555; margin-top: 4px;">Comma-separated keywords that trigger immediate escalation</div>
          </div>
          
          <div>
            <label style="display: block; font-size: 13px; color: #999; margin-bottom: 6px;">AI Welcome Message</label>
            <textarea class="input-field" style="width: 100%; max-width: 500px; resize: vertical; min-height: 80px;">Hi! I'm the AI support assistant for Acme Corp. How can I help you today? I can answer questions about our products, billing, and technical issues.</textarea>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 400px; padding: 14px; background: #1c1c1c; border-radius: 10px;">
            <div>
              <div style="font-size: 13px; font-weight: 500;">Allow customer to request human</div>
              <div style="font-size: 12px; color: #666;">Show "Talk to agent" button anytime</div>
            </div>
            <div onclick="this.classList.toggle('on')" style="width: 44px; height: 24px; background: #22c55e; border-radius: 100px; position: relative; cursor: pointer;">
              <div style="position: absolute; right: 3px; top: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: all 0.2s;"></div>
            </div>
          </div>
          
          <button class="btn-primary" style="width: fit-content;">Save AI Settings</button>
        </div>
      </div>
      
      <!-- Widget embed code -->
      <div class="card" style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">Widget Embed Code</h2>
        <p style="font-size: 13px; color: #666; margin-bottom: 16px;">Add this script to your website to activate the chat widget</p>
        <div style="background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; padding: 16px; font-family: monospace; font-size: 12px; color: #999; position: relative; max-width: 600px;">
          <code style="color: #6a4cf5;">&lt;script</code><br>
          &nbsp;&nbsp;<code style="color: #22c55e;">src</code>=<code style="color: #ff7a3d;">"https://supportiq.io/widget.js"</code><br>
          &nbsp;&nbsp;<code style="color: #22c55e;">data-key</code>=<code style="color: #ff7a3d;">"sk_live_acme_prod_••••••••"</code><br>
          &nbsp;&nbsp;<code style="color: #22c55e;">data-color</code>=<code style="color: #ff7a3d;">"#6a4cf5"</code><br>
          <code style="color: #6a4cf5;">&gt;&lt;/script&gt;</code>
          <button onclick="copyEmbed()" style="position: absolute; top: 12px; right: 12px; background: #1c1c1c; border: 1px solid #262626; border-radius: 6px; padding: 6px 12px; color: #999; font-size: 11px; cursor: pointer;">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <a href="/widget" class="btn-secondary" style="font-size: 12px; text-decoration: none;"><i class="fas fa-eye"></i> Preview Widget</a>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    function copyEmbed() { 
      navigator.clipboard.writeText('<script src="https://supportiq.io/widget.js" data-key="sk_live_acme_prod" data-color="#6a4cf5"><\/script>');
      event.target.textContent = '✓ Copied!';
      setTimeout(() => { event.target.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
    }
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
    body { background: #f5f5f5; font-family: 'Inter', sans-serif; min-height: 100vh; }
    .demo-site { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    .demo-header { background: #1a1a2e; color: white; padding: 16px 24px; display: flex; gap: 16px; align-items: center; border-radius: 12px; margin-bottom: 24px; }
    .demo-card { background: white; border-radius: 12px; padding: 32px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    
    /* Chat Widget */
    #chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 1000; font-family: 'Inter', sans-serif; }
    #chat-button { width: 52px; height: 52px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(106,76,245,0.5); transition: transform 0.2s; }
    #chat-button:hover { transform: scale(1.08); }
    #chat-panel { display: none; position: fixed; bottom: 90px; right: 24px; width: 360px; max-height: 580px; background: #141414; border: 1px solid #262626; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); flex-direction: column; }
    #chat-panel.open { display: flex; }
    
    .chat-header { padding: 16px 18px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 10px; background: #141414; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #090909; }
    .chat-input-area { padding: 12px 16px; border-top: 1px solid #1a1a1a; background: #141414; }
    
    .msg-ai { background: rgba(106,76,245,0.15); border-radius: 12px 12px 12px 4px; padding: 10px 14px; max-width: 85%; }
    .msg-user { background: #1c1c1c; border-radius: 12px 12px 4px 12px; padding: 10px 14px; max-width: 85%; align-self: flex-end; }
    
    @keyframes typing { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1);opacity:1} }
    .dot { width: 5px; height: 5px; background: #666; border-radius: 50%; display: inline-block; animation: typing 1.4s infinite; }
    .dot:nth-child(2){animation-delay:.2s}
    .dot:nth-child(3){animation-delay:.4s}
    
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    
    .source-pill { font-size: 10px; color: #6a4cf5; background: rgba(106,76,245,0.15); padding: 2px 8px; border-radius: 100px; border: 1px solid rgba(106,76,245,0.25); cursor: pointer; display: inline-block; margin-top: 6px; }
    
    .suggested-btn { background: #1c1c1c; border: 1px solid #262626; border-radius: 8px; padding: 7px 12px; font-size: 12px; color: #ccc; cursor: pointer; text-align: left; transition: all 0.15s; font-family: inherit; }
    .suggested-btn:hover { background: #262626; color: #fff; }
    
    #unread-badge { position: absolute; top: -4px; right: -4px; background: #d44df0; color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #f5f5f5; }
  </style>
</head>
<body>

<!-- Demo website content -->
<div class="demo-site">
  <div style="background: #141414; color: #999; padding: 8px 16px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
    <i class="fas fa-info-circle" style="color: #6a4cf5;"></i>
    This is a demo page showing the SupportIQ chat widget embedded on a customer website. Click the purple button in the bottom-right corner!
    <a href="/dashboard" style="margin-left: auto; color: #6a4cf5; text-decoration: none;">← Dashboard</a>
  </div>

  <div class="demo-header">
    <i class="fas fa-store" style="font-size: 20px;"></i>
    <div>
      <div style="font-size: 16px; font-weight: 600;">Acme Corp — Help Center</div>
      <div style="font-size: 13px; opacity: 0.6;">Product documentation and support</div>
    </div>
  </div>
  
  <div class="demo-card">
    <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px;">Getting Started Guide</h1>
    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Welcome to Acme Corp! This guide will help you set up your account and get started with our platform quickly.</p>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      ${['Account Setup', 'API Integration', 'Billing & Plans', 'Troubleshooting'].map(t => `
      <div style="border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px;">
        <div style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px;">${t}</div>
        <div style="font-size: 13px; color: #888;">Learn how to ${t.toLowerCase()}</div>
      </div>`).join('')}
    </div>
  </div>
  
  <div class="demo-card">
    <h2 style="font-size: 16px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">Frequently Asked Questions</h2>
    ${['How do I reset my password?', 'What payment methods do you accept?', 'How does API rate limiting work?'].map(q => `
    <div style="border-bottom: 1px solid #f0f0f0; padding: 12px 0;">
      <div style="font-size: 14px; font-weight: 500; color: #333;">${q}</div>
    </div>`).join('')}
  </div>
</div>

<!-- Chat Widget -->
<div id="chat-widget">
  <div style="position: relative;">
    <button id="chat-button" onclick="toggleChat()">
      <i class="fas fa-comment-dots" id="chat-icon" style="color: white; font-size: 20px;"></i>
      <i class="fas fa-times" id="close-icon" style="color: white; font-size: 18px; display: none;"></i>
    </button>
    <div id="unread-badge">1</div>
  </div>
</div>

<div id="chat-panel">
  <!-- Header -->
  <div class="chat-header">
    <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <i class="fas fa-bolt" style="color: white; font-size: 13px;"></i>
    </div>
    <div style="flex: 1;">
      <div style="font-size: 13px; font-weight: 600; color: #fff;">Acme Support AI</div>
      <div style="font-size: 11px; color: #22c55e; display: flex; align-items: center; gap: 4px;"><span style="width: 5px; height: 5px; background: #22c55e; border-radius: 50; display: inline-block;"></span> Online — replies instantly</div>
    </div>
    <button onclick="toggleChat()" style="background: none; border: none; color: #666; cursor: pointer; font-size: 14px;"><i class="fas fa-times"></i></button>
  </div>
  
  <!-- Messages -->
  <div class="chat-messages" id="messages-container">
    <!-- Welcome message -->
    <div style="display: flex; gap: 8px; align-items: flex-start;">
      <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #6a4cf5, #d44df0); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <i class="fas fa-bolt" style="color: white; font-size: 9px;"></i>
      </div>
      <div>
        <div class="msg-ai">
          <div style="font-size: 11px; color: #6a4cf5; margin-bottom: 4px; font-weight: 600;">AI Assistant</div>
          <div style="font-size: 12px; color: #ccc; line-height: 1.6;">👋 Hi there! I'm the AI support assistant for Acme Corp. I can answer questions about our products, billing, and technical setup. How can I help you today?</div>
        </div>
        <div style="font-size: 10px; color: #555; margin-top: 4px;">just now</div>
      </div>
    </div>
    
    <!-- Suggested questions -->
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Suggested</div>
      <button class="suggested-btn" onclick="sendSuggestedMsg('How do I reset my password?')">🔑 How do I reset my password?</button>
      <button class="suggested-btn" onclick="sendSuggestedMsg('What are your pricing plans?')">💳 What are your pricing plans?</button>
      <button class="suggested-btn" onclick="sendSuggestedMsg('How do I connect to the API?')">🔌 How do I connect to the API?</button>
    </div>
  </div>
  
  <!-- Input -->
  <div class="chat-input-area">
    <div style="display: flex; gap: 8px; align-items: center;">
      <input id="chat-input" type="text" placeholder="Ask me anything..." 
        style="flex: 1; background: #1c1c1c; border: 1px solid #262626; border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 13px; outline: none; font-family: inherit;"
        onfocus="this.style.borderColor='rgba(0,153,255,0.4)'" 
        onblur="this.style.borderColor='#262626'"
        onkeypress="if(event.key==='Enter') sendMsg()">
      <button onclick="sendMsg()" style="background: linear-gradient(135deg, #6a4cf5, #d44df0); border: none; border-radius: 8px; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <i class="fas fa-paper-plane" style="color: white; font-size: 11px;"></i>
      </button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
      <div style="font-size: 10px; color: #444;">Powered by <span style="color: #6a4cf5;">SupportIQ</span></div>
      <button id="human-btn" onclick="requestHuman()" style="background: none; border: none; font-size: 10px; color: #555; cursor: pointer; font-family: inherit;">Talk to agent →</button>
    </div>
  </div>
</div>

<script>
  let isOpen = false;
  let msgCount = 0;
  
  function toggleChat() {
    isOpen = !isOpen;
    document.getElementById('chat-panel').classList.toggle('open', isOpen);
    document.getElementById('chat-icon').style.display = isOpen ? 'none' : 'block';
    document.getElementById('close-icon').style.display = isOpen ? 'block' : 'none';
    if (isOpen) document.getElementById('unread-badge').style.display = 'none';
  }
  
  function addMsg(content, type, sources, showEscalate) {
    const container = document.getElementById('messages-container');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:8px;align-items:flex-start;' + (type === 'user' ? 'flex-direction:row-reverse;' : '');
    
    const avatar = document.createElement('div');
    if (type === 'ai') {
      avatar.style.cssText = 'width:24px;height:24px;background:linear-gradient(135deg,#6a4cf5,#d44df0);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;';
      avatar.innerHTML = '<i class="fas fa-bolt" style="color:white;font-size:9px;"></i>';
    } else {
      avatar.style.cssText = 'width:24px;height:24px;background:#333;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;font-size:10px;font-weight:700;color:#fff;';
      avatar.textContent = 'You';
    }
    
    const bubble = document.createElement('div');
    bubble.className = type === 'ai' ? 'msg-ai' : 'msg-user';
    
    let html = '';
    if (type === 'ai') html += '<div style="font-size:11px;color:#6a4cf5;margin-bottom:4px;font-weight:600;">AI Assistant</div>';
    html += '<div style="font-size:12px;color:#ccc;line-height:1.6;">' + content + '</div>';
    
    if (sources && sources.length) {
      sources.forEach(s => { html += '<span class="source-pill">📄 ' + s + '</span> '; });
    }
    
    if (showEscalate) {
      html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);">';
      html += '<button onclick="requestHuman()" style="background:rgba(106,76,245,0.2);border:1px solid rgba(106,76,245,0.4);border-radius:8px;padding:7px 14px;font-size:12px;color:#6a4cf5;cursor:pointer;font-family:inherit;width:100%;text-align:center;">Connect me to a human agent →</button>';
      html += '</div>';
    }
    
    bubble.innerHTML = html;
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }
  
  function addTyping() {
    const container = document.getElementById('messages-container');
    const wrapper = document.createElement('div');
    wrapper.id = 'typing-indicator';
    wrapper.style.cssText = 'display:flex;gap:8px;align-items:center;';
    wrapper.innerHTML = '<div style="width:24px;height:24px;background:linear-gradient(135deg,#6a4cf5,#d44df0);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-bolt" style="color:white;font-size:9px;"></i></div><div style="background:rgba(106,76,245,0.1);border-radius:12px;padding:10px 14px;display:flex;gap:4px;"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }
  
  function removeTyping() { document.getElementById('typing-indicator')?.remove(); }
  
  async function sendMsg() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    
    addMsg(msg, 'user');
    addTyping();
    
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({message: msg}) });
      const data = await res.json();
      removeTyping();
      addMsg(data.content, 'ai', data.sources, data.escalate || data.confidence < 0.5);
    } catch(e) {
      removeTyping();
      addMsg('Sorry, I encountered an error. Please try again or contact our team.', 'ai', [], true);
    }
  }
  
  function sendSuggestedMsg(msg) {
    document.getElementById('chat-input').value = msg;
    // Remove suggestion buttons
    document.querySelectorAll('.suggested-btn').forEach(b => b.closest('div')?.remove());
    sendMsg();
  }
  
  function requestHuman() {
    addMsg('Connecting you to a human agent now...', 'ai');
    setTimeout(() => {
      addMsg('You are now in a queue. Our next available agent will be with you shortly. Estimated wait: 2 minutes. 🕐', 'ai');
    }, 1000);
    document.getElementById('human-btn').textContent = '⏳ In queue...';
    document.getElementById('human-btn').disabled = true;
  }
  
  // Auto-open after 3s
  setTimeout(() => {
    if (!isOpen) {
      toggleChat();
    }
  }, 3000);
</script>
</body>
</html>`
}

export default app
