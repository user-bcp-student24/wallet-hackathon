import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isValidDni, isValidPenAmount, parseDemoPaymentQr } from './wallet-rules';
import { WalletApiService, WalletState } from './wallet-api.service';

type Page = 'home' | 'onboarding' | 'contacts' | 'qr' | 'wallet' | 'operations';
type WalletOperation = {
  id: string;
  label: string;
  detail: string;
  amount: number;
  kind: 'out' | 'in';
  status: 'Completada' | 'Pendiente' | 'Vista previa';
  date: string;
};
type Contact = { name: string; phone: string; initials: string; color: string };

const demoSessionKey = 'plata-demo-session';
const walletContextKey = 'plata-demo-wallet-context';

type WalletContext = { documentNumber: string; verificationId: string; walletId: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  signedIn = false;
  authMode: 'login' | 'register' = 'login';
  loginDocumentNumber = '';
  loginMessage = '';
  loginMessageType: 'error' | 'info' = 'info';
  loginLoading = false;
  readonly demoDnis = new Set<string>();
  readonly customerName = 'Cliente Demo';

  readonly navigation: { id: Page; label: string; icon: string; group: string }[] = [
    { id: 'home', label: 'Inicio', icon: '⌂', group: 'Principal' },
    { id: 'contacts', label: 'Enviar dinero', icon: '↗', group: 'Principal' },
    //{ id: 'qr', label: 'Pagar y cobrar con QR', icon: '▦', group: 'Principal' },
    { id: 'wallet', label: 'Mi wallet', icon: '▤', group: 'Tu cuenta' },
    { id: 'operations', label: 'Operaciones', icon: '◷', group: 'Tu cuenta' },
    //{ id: 'onboarding', label: 'Registro de cliente', icon: '＋', group: 'Tu cuenta' }
  ];

  readonly contacts: Contact[] = [
    { name: 'Camila Torres', phone: '987 654 321', initials: 'CT', color: 'lavender' },
    { name: 'Mateo Rojas', phone: '945 321 876', initials: 'MR', color: 'peach' },
    { name: 'Lucía Mendoza', phone: '998 112 234', initials: 'LM', color: 'mint' },
    { name: 'Diego Salazar', phone: '912 345 678', initials: 'DS', color: 'sky' }
  ];

  operations: WalletOperation[] = [
    { id: 'OP-2026-008421', label: 'María Fernanda', detail: 'Pago a contacto · Hoy, 10:42 am', amount: -48.5, kind: 'out', status: 'Completada', date: 'Hoy' },
    { id: 'OP-2026-008420', label: 'Café Origen', detail: 'Pago con QR · Hoy, 9:18 am', amount: -16, kind: 'out', status: 'Completada', date: 'Hoy' },
    { id: 'OP-2026-008419', label: 'Pago recibido', detail: 'De Andrés Paredes · Ayer, 6:30 pm', amount: 85, kind: 'in', status: 'Completada', date: 'Ayer' },
    { id: 'OP-2026-008418', label: 'Mercado San Isidro', detail: 'Pago con QR · Ayer, 1:05 pm', amount: -32.9, kind: 'out', status: 'Pendiente', date: 'Ayer' }
  ];

  page: Page = 'home';
  contactQuery = '';
  selectedContact: Contact | null = null;
  paymentAmount = '';
  receipt: WalletOperation | null = null;
  notice = '';
  showNotice = false;
  documentNumber = '';
  onboardingState: 'idle' | 'loading' | 'success' | 'error' | 'pending' = 'idle';
  onboardingMessage = '';
  walletActive = false;
  walletBalances: WalletState | null = null;
  walletApiMessage = '';
  hasVerification = false;
  private verificationId = '';
  private walletId = '';
  private registeredDocument = '';
  searchedOperation = '';
  selectedOperation: WalletOperation | null = null;
  qrAmount = '';
  qrDataUrl = '';
  qrCustomer = '';
  qrPayAmount = '';
  qrMessage = '';
  qrState: 'idle' | 'valid' | 'invalid' = 'idle';
  qrLoading = false;

  constructor(
    private readonly changeDetector: ChangeDetectorRef,
    private readonly walletApi: WalletApiService
  ) {
    this.signedIn = sessionStorage.getItem(demoSessionKey) === 'active';
    this.walletActive = this.signedIn;
    const savedContext = sessionStorage.getItem(walletContextKey);
    if (savedContext) {
      try {
        const context = JSON.parse(savedContext) as WalletContext;
        if (context.documentNumber && context.verificationId && context.walletId) {
          this.registeredDocument = context.documentNumber;
          this.verificationId = context.verificationId;
          this.walletId = context.walletId;
          this.hasVerification = true;
          this.demoDnis.add(context.documentNumber);
        }
      } catch {
        sessionStorage.removeItem(walletContextKey);
      }
    }
    if (this.signedIn && this.walletId) {
      void this.refreshWalletBalances().catch(() => {
        this.walletBalances = null;
        this.walletActive = false;
      });
    }
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
  }

  get filteredContacts(): Contact[] {
    const query = this.contactQuery.trim().toLocaleLowerCase('es');
    if (!query) return this.contacts;
    return this.contacts.filter((contact) =>
      `${contact.name} ${contact.phone}`.toLocaleLowerCase('es').includes(query)
    );
  }

  get filteredOperations(): WalletOperation[] {
    const query = this.searchedOperation.trim().toLocaleLowerCase('es');
    if (!query) return this.operations;
    return this.operations.filter((operation) =>
      `${operation.id} ${operation.label} ${operation.detail}`.toLocaleLowerCase('es').includes(query)
    );
  }

  goTo(page: Page): void {
    this.page = page;
    this.notice = '';
    this.showNotice = false;
    if (page !== 'contacts') this.receipt = null;
    if (page === 'wallet' && this.walletId) {
      void this.refreshWalletBalances().catch((error: unknown) => {
        this.walletApiMessage = error instanceof Error ? error.message : 'No se pudieron consultar los saldos.';
      });
    }
  }

  showLogin(): void {
    if (this.authMode === 'register' && isValidDni(this.documentNumber)) {
      this.loginDocumentNumber = this.documentNumber;
    }
    this.authMode = 'login';
    this.loginMessage = '';
    this.documentNumber = '';
    this.onboardingState = 'idle';
    this.onboardingMessage = '';
  }

  showRegistration(): void {
    this.authMode = 'register';
    this.loginMessage = '';
    this.documentNumber = '';
    this.onboardingState = 'idle';
    this.onboardingMessage = '';
  }

  async attemptLogin(): Promise<void> {
    if (!isValidDni(this.loginDocumentNumber)) {
      this.loginMessageType = 'error';
      this.loginMessage = 'Ingresa un DNI válido de exactamente 8 números.';
      return;
    }
    if (
      !this.demoDnis.has(this.loginDocumentNumber) ||
      this.loginDocumentNumber !== this.registeredDocument ||
      !this.verificationId
    ) {
      this.loginMessageType = 'info';
      this.loginMessage = 'No encontramos una wallet creada para ese identificador de prueba. Puedes crear una desde “Crear mi wallet”.';
      return;
    }

    this.loginLoading = true;
    this.loginMessage = '';
    try {
      const verification = await this.walletApi.consultVerification(this.verificationId);
      if (verification.status !== 'ACTIVE') {
        this.walletActive = false;
        this.loginMessageType = 'info';
        this.loginMessage = verification.status === 'PENDING'
          ? 'La verificación de tu wallet sigue pendiente.'
          : 'La verificación fue rechazada. No se inició sesión.';
        return;
      }

      this.walletId = verification.wallet_id || this.walletId;
      this.signedIn = true;
      this.walletActive = true;
      this.page = 'home';
      sessionStorage.setItem(demoSessionKey, 'active');
      if (this.walletId) {
        void this.refreshWalletBalances().catch((error: unknown) => {
          this.walletApiMessage = error instanceof Error ? error.message : 'No se pudieron consultar los saldos.';
        });
      }
    } catch (error) {
      this.loginMessageType = 'error';
      this.loginMessage = error instanceof Error
        ? `No pudimos verificar tu wallet: ${error.message}`
        : 'No pudimos verificar tu wallet. Inténtalo nuevamente.';
    } finally {
      this.loginLoading = false;
    }
  }

  async registerCustomer(): Promise<void> {
    if (!isValidDni(this.documentNumber)) {
      this.onboardingState = 'error';
      this.onboardingMessage = 'Ingresa un DNI válido de exactamente 8 números.';
      return;
    }
    this.onboardingState = 'loading';
    this.onboardingMessage = '';
    try {
      const created = await this.walletApi.createWallet(this.documentNumber);
      this.verificationId = created.id;
      this.walletId = created.wallet_id;
      this.registeredDocument = this.documentNumber;
      this.hasVerification = true;
      this.demoDnis.add(this.documentNumber);
      this.walletActive = created.status === 'ACTIVE';
      this.walletBalances = null;
      sessionStorage.setItem(walletContextKey, JSON.stringify({
        documentNumber: this.registeredDocument,
        verificationId: this.verificationId,
        walletId: this.walletId
      }));

      if (created.status === 'PENDING') {
        this.onboardingState = 'pending';
        this.onboardingMessage = 'Tu verificación quedó pendiente según la respuesta de registro.';
        return;
      }
      if (created.status !== 'ACTIVE') {
        this.onboardingState = 'error';
        this.onboardingMessage = 'La respuesta de registro indica que la wallet no está activa.';
        return;
      }
      this.onboardingState = 'success';
      this.onboardingMessage = 'Registro completado. Tu wallet está activa.';
      this.enterRegisteredDemoWallet();
    } catch (error) {
      this.onboardingState = 'error';
      this.onboardingMessage = error instanceof Error
        ? `No pudimos completar la verificación: ${error.message}`
        : 'No pudimos completar la verificación. Inténtalo nuevamente.';
    }
  }

  enterRegisteredDemoWallet(): void {
    if (this.onboardingState !== 'success') return;
    this.loginDocumentNumber = this.documentNumber;
    this.signedIn = true;
    this.page = 'home';
    this.loginMessage = '';
    sessionStorage.setItem(demoSessionKey, 'active');
  }

  logout(): void {
    sessionStorage.removeItem(demoSessionKey);
    this.signedIn = false;
    this.walletActive = false;
    this.page = 'home';
    this.authMode = 'login';
    this.loginDocumentNumber = '';
    this.loginMessage = '';
    this.documentNumber = '';
    this.onboardingState = 'idle';
    this.onboardingMessage = '';
    this.walletApiMessage = '';
  }

  isValidAmount(value: string): boolean {
    return isValidPenAmount(value);
  }

  formatAmount(value: string): string {
    const amount = Number(value);
    return this.formatMoney(Number.isFinite(amount) ? amount : 0);
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Math.abs(value));
  }

  sendPayment(): void {
    if (!this.selectedContact || !this.isValidAmount(this.paymentAmount)) {
      this.notice = 'Elige un contacto e ingresa un monto mayor a S/ 0.00 y hasta S/ 500.00.';
      this.showNotice = true;
      return;
    }
    const operation: WalletOperation = {
      id: `DEMO-${Date.now()}`,
      label: this.selectedContact.name,
      detail: `Pago a ${this.selectedContact.phone} · Ahora`,
      amount: -Number(this.paymentAmount),
      kind: 'out',
      status: 'Vista previa',
      date: 'Ahora'
    };
    this.receipt = operation;
    this.operations = [operation, ...this.operations];
  }

  walletAmount(value: number | undefined): string {
    return value === undefined ? 'S/ --' : this.formatMoney(value / 100);
  }

  private async refreshWalletBalances(): Promise<void> {
    if (!this.walletId) return;
    this.walletBalances = await this.walletApi.consultWallet(this.walletId);
    this.walletActive = this.walletBalances.status === 'ACTIVE';
    this.walletApiMessage = '';
  }

  selectOperation(operation: WalletOperation): void {
    this.selectedOperation = this.selectedOperation?.id === operation.id ? null : operation;
  }

  async makeQr(): Promise<void> {
    this.qrCustomer = '';
    this.qrPayAmount = '';
    this.qrMessage = '';
    if (!this.isValidAmount(this.qrAmount)) {
      this.qrState = 'invalid';
      this.qrMessage = 'Ingresa un monto mayor a S/ 0.00 y hasta S/ 500.00.';
      this.qrDataUrl = '';
      return;
    }
    const payload = `wallet://pay?customer=Cliente%20Plata&amount=${Number(this.qrAmount).toFixed(2)}`;
    try {
      const qrCode = await import('qrcode');
      this.qrDataUrl = await qrCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#162d28', light: '#ffffff' } });
      this.qrState = 'valid';
      this.qrMessage = 'QR de cobro generado. Este código de demostración no inicia un cobro real.';
      this.changeDetector.markForCheck();
    } catch (error) {
      this.qrState = 'invalid';
      this.qrMessage = 'No se pudo generar el código QR.';
      this.changeDetector.markForCheck();
      console.error('Error generando QR de cobro.', error);
    }
  }

  async readQr(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.qrState = 'invalid';
      this.qrCustomer = '';
      this.qrPayAmount = '';
      this.qrMessage = 'Selecciona una imagen para leer el QR.';
      return;
    }
    this.qrLoading = true;
    this.qrState = 'idle';
    this.qrCustomer = '';
    this.qrPayAmount = '';
    this.qrDataUrl = '';
    this.qrMessage = '';
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      const imageLoaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo cargar la imagen del QR.'));
      });
      image.src = imageUrl;
      await imageLoaded;

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la imagen del QR.');
      context.drawImage(image, 0, 0);

      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const result = reader.decodeFromCanvas(canvas);
      this.parseQr(result.getText());
    } catch {
      this.qrState = 'invalid';
      this.qrMessage = 'No pudimos leer un QR en la imagen. Prueba con otra imagen más nítida.';
    } finally {
      URL.revokeObjectURL(imageUrl);
      this.qrLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  private parseQr(rawValue: string): void {
    const payment = parseDemoPaymentQr(rawValue);
    if (payment) {
      this.qrCustomer = payment.customer;
      this.qrPayAmount = payment.amount;
      this.qrState = 'valid';
      this.qrMessage = 'QR válido para esta demostración. Confirma el comercio y el monto antes de pagar.';
      this.changeDetector.markForCheck();
    } else {
      this.qrState = 'invalid';
      this.qrCustomer = '';
      this.qrPayAmount = '';
      this.qrMessage = 'El QR no es válido o no pertenece al formato de demostración de Plata.';
      this.changeDetector.markForCheck();
    }
  }
}
