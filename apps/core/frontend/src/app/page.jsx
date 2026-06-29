"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "../components/Navbar";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    fetch(`${API}/products?limit=8&sort=relevance`).then(r=>r.json()).then(d=>{ setProducts(d.products||[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);

  const CATEGORIES=[{icon:"👗",label:"Fashion",slug:"fashion"},{icon:"📱",label:"Phones",slug:"phones_tablets"},{icon:"🛒",label:"Food",slug:"food_groceries"},{icon:"💄",label:"Beauty",slug:"beauty_health"},{icon:"⚡",label:"Electronics",slug:"electronics"},{icon:"☀️",label:"Solar",slug:"solar_energy"},{icon:"👶",label:"Baby",slug:"baby_kids"},{icon:"💼",label:"Services",slug:"services"}];

  return (
    <>
      <Navbar />
      <main style={{background:"var(--dz-navy)",minHeight:"100vh"}}>
        {/* HERO */}
        <section style={{padding:"80px 24px 100px",textAlign:"center",background:"linear-gradient(180deg,#0D1525 0%,#0A0E1A 100%)",position:"relative"}}>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"600px",height:"600px",background:"radial-gradient(circle,rgba(0,163,255,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
          <div style={{maxWidth:"800px",margin:"0 auto",position:"relative"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:"32px"}}>
              <Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={120} height={120} style={{borderRadius:"24px",boxShadow:"0 0 60px rgba(0,163,255,0.5)",border:"2px solid rgba(0,163,255,0.4)"}} priority/>
            </div>
            <h1 style={{marginBottom:"16px"}}>
              <span style={{display:"block",fontSize:"clamp(2.5rem,7vw,4.5rem)",fontWeight:900,letterSpacing:"0.08em",background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>DUNAZOE</span>
              <span style={{fontSize:"clamp(1rem,3vw,1.5rem)",fontWeight:400,color:"#8A9AB5"}}>Buy Anything · Sell Everything · Ship Worldwide</span>
            </h1>
            <p style={{fontSize:"1.05rem",color:"#8A9AB5",marginBottom:"40px",lineHeight:1.7,maxWidth:"600px",margin:"0 auto 40px"}}>Nigeria's AI-powered super marketplace with built-in <span style={{color:"#00A3FF",fontWeight:600}}>Ajo savings</span>, escrow protection, and intelligent shipping.</p>
            <div style={{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap"}}>
              <Link href="/products" style={{padding:"16px 40px",borderRadius:"14px",fontSize:"1rem",fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#00A3FF,#0066FF)",textDecoration:"none",boxShadow:"0 0 30px rgba(0,163,255,0.4)"}}>🛒 Start Shopping</Link>
              <Link href="/register?role=vendor" style={{padding:"16px 40px",borderRadius:"14px",fontSize:"1rem",fontWeight:700,color:"#00A3FF",border:"2px solid rgba(0,163,255,0.35)",textDecoration:"none",background:"rgba(0,163,255,0.06)"}}>🏪 Sell on DUNAZOE</Link>
            </div>
          </div>
        </section>
        {/* CATEGORIES */}
        <section style={{padding:"60px 24px 40px",maxWidth:"1280px",margin:"0 auto"}}>
          <h2 style={{marginBottom:"24px",background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Shop by Category</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"12px"}}>
            {CATEGORIES.map(c=>(
              <Link key={c.slug} href={`/products?category=${c.slug}`} data-testid={`category-${c.slug}`} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"8px",padding:"20px 12px",background:"rgba(13,21,37,0.8)",border:"1px solid rgba(0,163,255,0.12)",borderRadius:"14px",textDecoration:"none",transition:"all 0.2s"}}>
                <span style={{fontSize:"2rem"}}>{c.icon}</span>
                <span style={{fontSize:"0.8rem",fontWeight:600,color:"#8A9AB5",textAlign:"center"}}>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
        {/* PRODUCTS */}
        <section style={{padding:"40px 24px 80px",maxWidth:"1280px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"24px"}}>
            <h2 style={{background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>All Products</h2>
            <Link href="/products" style={{color:"#00A3FF",fontSize:"0.88rem",textDecoration:"none",fontWeight:600}}>Browse all →</Link>
          </div>
          {loading ? (
            <div style={{display:"flex",justifyContent:"center",padding:"60px"}}><div className="dz-spinner"/></div>
          ) : products.length > 0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"16px"}}>
              {products.map(p=>(
                <Link key={p.id} href={`/products/${p.id}`} data-testid="product-card" style={{display:"block",background:"linear-gradient(145deg,#0D1525,#12203A)",border:"1px solid rgba(0,163,255,0.12)",borderRadius:"16px",overflow:"hidden",textDecoration:"none",transition:"all 0.25s"}}>
                  <div style={{width:"100%",height:"180px",background:p.images?`url(${p.images}) center/cover`:"#0D1525",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                    {!p.images&&<Image src="/assets/dunazoe-logo.jpg" alt="" width={48} height={48} style={{borderRadius:"10px",opacity:0.3}}/>}
                    {p.ajo_enabled&&<span style={{position:"absolute",top:"10px",right:"10px",background:"rgba(0,102,255,0.85)",borderRadius:"6px",padding:"3px 8px",fontSize:"0.7rem",fontWeight:600,color:"#fff"}}>⬡ Ajo</span>}
                  </div>
                  <div style={{padding:"14px"}}>
                    <p style={{fontSize:"0.88rem",fontWeight:600,color:"#fff",marginBottom:"6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                    <p style={{fontSize:"0.75rem",color:"#8A9AB5",marginBottom:"10px"}}>{p.business_name||"DUNAZOE Store"}</p>
                    <span style={{fontSize:"1.15rem",fontWeight:800,background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>₦{parseFloat(p.price).toLocaleString("en-NG")}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"80px",color:"#8A9AB5"}}>
              <p style={{marginBottom:"16px"}}>No products yet. Be the first vendor!</p>
              <Link href="/register?role=vendor" style={{padding:"12px 24px",borderRadius:"12px",background:"linear-gradient(135deg,#00A3FF,#0066FF)",color:"#fff",textDecoration:"none",fontWeight:700}}>Start Selling</Link>
            </div>
          )}
        </section>
        {/* AJO CTA */}
        <section style={{background:"linear-gradient(135deg,rgba(0,103,255,0.12),rgba(0,163,255,0.06))",borderTop:"1px solid rgba(0,163,255,0.15)",padding:"80px 24px",textAlign:"center"}}>
          <div style={{maxWidth:"600px",margin:"0 auto"}}>
            <div style={{fontSize:"3rem",marginBottom:"16px"}}>⬡</div>
            <h2 style={{marginBottom:"16px",background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Save with Ajo Instalments</h2>
            <p style={{color:"#8A9AB5",lineHeight:1.7,marginBottom:"32px"}}>Open a free Ajo savings account. Save daily, weekly, or monthly. Use savings to buy anything on DUNAZOE.</p>
            <Link href="/thrift" style={{padding:"16px 40px",borderRadius:"14px",fontSize:"1rem",fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#00A3FF,#0066FF)",textDecoration:"none",boxShadow:"0 0 30px rgba(0,163,255,0.4)"}}>⬡ Open Ajo Account Free</Link>
          </div>
        </section>
        {/* GET THE APP */}
        <section style={{background:"linear-gradient(135deg,rgba(0,20,50,0.95),rgba(10,14,26,0.98))",borderTop:"1px solid rgba(0,163,255,0.15)",padding:"80px 24px",textAlign:"center"}}>
          <div style={{maxWidth:"680px",margin:"0 auto"}}>
            <div style={{fontSize:"3rem",marginBottom:"16px"}}>📲</div>
            <h2 style={{marginBottom:"12px",background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Get the DUNAZOE App</h2>
            <p style={{color:"#8A9AB5",lineHeight:1.7,marginBottom:"36px"}}>Shop, sell, save and ship — all from your phone. Install once, works offline.</p>
            <div style={{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap",marginBottom:"28px"}}>
              <a href="/dunazoe.apk" download style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 28px",borderRadius:"14px",background:"linear-gradient(135deg,#00A3FF,#0066FF)",color:"#fff",textDecoration:"none",fontWeight:700,fontSize:"0.95rem",boxShadow:"0 0 24px rgba(0,163,255,0.35)"}}>
                <span style={{fontSize:"1.3rem"}}>🤖</span> Download Android APK
              </a>
              <a href="/dunazoe.ipa" download style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 28px",borderRadius:"14px",border:"2px solid rgba(0,163,255,0.3)",color:"#00A3FF",textDecoration:"none",fontWeight:700,fontSize:"0.95rem",background:"rgba(0,163,255,0.06)"}}>
                <span style={{fontSize:"1.3rem"}}>🍎</span> iOS / TestFlight
              </a>
            </div>
            <div style={{padding:"18px 24px",background:"rgba(0,163,255,0.06)",border:"1px solid rgba(0,163,255,0.15)",borderRadius:"14px",color:"#8A9AB5",fontSize:"0.84rem",lineHeight:1.8}}>
              <strong style={{color:"#fff"}}>Install as Web App (any phone):</strong><br/>
              Open <span style={{color:"#00A3FF",fontWeight:600}}>dunazoe.com</span> in Chrome or Safari → tap the share/menu button → <em>Add to Home Screen</em>
            </div>
          </div>
        </section>
        {/* FOOTER */}
        <footer style={{background:"#060B14",borderTop:"1px solid rgba(0,163,255,0.1)",padding:"40px 24px 24px"}}>
          <div style={{maxWidth:"1280px",margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={40} height={40} style={{borderRadius:"8px",boxShadow:"0 0 12px rgba(0,163,255,0.4)"}}/>
              <span style={{fontWeight:800,letterSpacing:"0.08em",background:"linear-gradient(135deg,#00A3FF,#0066FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>DUNAZOE</span>
            </div>
            <p style={{fontSize:"0.78rem",color:"#3D4F6E"}}>© 2026 DUNAZOE. Fintech OS on Paystack/Stripe. dunazoe.com</p>
          </div>
        </footer>
      </main>
    </>
  );
}
