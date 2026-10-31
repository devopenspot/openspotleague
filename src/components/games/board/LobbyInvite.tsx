"use client";

import { QRCodeSVG } from "qrcode.react";

/** Sized to scan from arm's length in daylight, so nobody types a code. */
const QR_SIZE_PX = 184;

export function LobbyInvite({ url }: { url: string }) {
  return (
    <section
      aria-label="Invite a rider"
      className="flex flex-col items-center gap-3 text-center"
    >
      <div
        role="img"
        aria-label="QR code for shared link"
        className="rounded-lg border-2 border-on-surface bg-white p-3"
      >
        <QRCodeSVG
          value={url}
          size={QR_SIZE_PX}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
        />
      </div>
      <p className="text-base leading-6 text-on-surface">
        Have your friend scan this with their phone camera
      </p>
    </section>
  );
}
