import QRCode from 'qrcode';

export class QRGenerator {
  static async generateQRCode(data: any): Promise<string> {
    try {
      const qrString = JSON.stringify(data);
      const qrCode = await QRCode.toString(qrString, {
        type: 'svg',
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCode;
    } catch (error) {
      throw new Error(`QR Code generation failed: ${error}`);
    }
  }

  static generateAccessPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async generateAccessQRData(bookingId: string, accessPin: string, validFrom: Date, validUntil: Date) {
    const accessData = {
      booking_id: bookingId,
      access_pin: accessPin,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
      generated_at: new Date().toISOString()
    };
    return this.generateQRCode(accessData);
  }
}
