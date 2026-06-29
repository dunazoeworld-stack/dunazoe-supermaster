"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(10,14,26,0.96)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(0,163,255,0.12)", padding:"0 24px" }}>
      <div style={{ maxWidth:"1280px", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:"60px" }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:"10px", textDecoration:"none" }}>
          <Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={36} height={36} style={{ borderRadius:"8px", boxShadow:"0 0 12px rgba(0,163,255,0.4)" }} />
          <span style={{ fontWeight:900, letterSpacing:"0.08em", fontSize:"1.1rem", background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>DUNAZOE</span>
        </Link>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <Link href="/products" style={{ padding:"8px 16px", borderRadius:"9px", color:"#8A9AB5", textDecoration:"none", fontSize:"0.85rem", fontWeight:600 }}>Shop</Link>
          <Link href="/register?role=vendor" style={{ padding:"8px 16px", borderRadius:"9px", color:"#8A9AB5", textDecoration:"none", fontSize:"0.85rem", fontWeight:600 }}>Sell</Link>
          <Link href="/thrift" style={{ padding:"8px 16px", borderRadius:"9px", color:"#8A9AB5", textDecoration:"none", fontSize:"0.85rem", fontWeight:600 }}>Ajo</Link>
          <Link href="/login" style={{ padding:"8px 18px", borderRadius:"9px", background:"linear-gradient(135deg,#00A3FF,#0066FF)", color:"#fff", textDecoration:"none", fontSize:"0.85rem", fontWeight:700 }}>Sign In</Link>
        </div>
      </div>
    </nav>
  );
}
