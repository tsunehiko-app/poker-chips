import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  url: string;
}

function QRCodeDisplay({ url }: QRCodeDisplayProps) {
  return (
    <div className="qr-code-container">
      <QRCodeSVG
        value={url}
        size={180}
        bgColor="transparent"
        fgColor="#e2e8f0"
        level="M"
      />
    </div>
  );
}

export default QRCodeDisplay;
