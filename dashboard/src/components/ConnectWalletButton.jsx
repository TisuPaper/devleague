import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet, Copy, Check, LogOut } from 'lucide-react';
import { usePhantomWallet, shortenAddress } from '../hooks/usePhantomWallet';
import './ConnectWalletButton.css';

const COPIED_RESET_MS = 1600;

const ConnectWalletButton = () => {
  const { status, publicKey, error, connect, disconnect } = usePhantomWallet();
  // Tracked as "the address the menu was opened for" rather than a bare
  // boolean: the menu then closes by itself on disconnect or on an account
  // switch in the extension, so it can never sit open over a stale address.
  const [menuFor, setMenuFor] = useState(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  const connected = status === 'connected' && publicKey;
  const menuOpen = Boolean(connected && menuFor === publicKey);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setMenuFor(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuFor(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure origin or denied permission). The full
      // address is already rendered in the menu, so it stays copyable by hand.
    }
  }, [publicKey]);

  if (connected) {
    return (
      <div className="wallet-connect" ref={containerRef}>
        <button
          type="button"
          className="wallet-btn connected"
          onClick={() => setMenuFor(menuOpen ? null : publicKey)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Phantom wallet"
        >
          <span className="wallet-dot" aria-hidden="true" />
          <span className="wallet-address">{shortenAddress(publicKey)}</span>
        </button>

        {menuOpen && (
          <div className="wallet-menu" role="menu">
            <div className="wallet-menu-header">
              <span className="wallet-menu-label">Phantom</span>
              <span className="wallet-menu-address">{publicKey}</span>
            </div>

            <button type="button" className="wallet-menu-item" role="menuitem" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy address'}
            </button>

            <button
              type="button"
              className="wallet-menu-item danger"
              role="menuitem"
              onClick={() => {
                setMenuFor(null);
                disconnect();
              }}
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  const unsupported = status === 'unsupported';
  const connecting = status === 'connecting';

  return (
    <div className="wallet-connect" ref={containerRef}>
      <button
        type="button"
        className="wallet-btn"
        onClick={connect}
        disabled={connecting || status === 'detecting'}
        title={unsupported ? 'Phantom not detected — opens phantom.com to install' : 'Connect your Phantom wallet'}
      >
        <Wallet size={15} aria-hidden="true" />
        {connecting ? 'Connecting…' : unsupported ? 'Install Phantom' : 'Connect Wallet'}
      </button>
      {error && <span className="wallet-error" role="alert">{error}</span>}
    </div>
  );
};

export default ConnectWalletButton;
