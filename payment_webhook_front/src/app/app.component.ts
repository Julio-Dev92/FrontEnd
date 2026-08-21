import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface PaymentEventLog {
  id: number; id_transacao: string | null; id_contrato: string | null;
  rawPayload: string; processingStatus: string; errorMessage: string | null;
  receivedAt: string; processedAt: string | null;
}
interface PagedResult<T> { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number; }

@Component({
  selector: 'app-root', imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html', styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);
  apiUrl = 'http://localhost:5161'; apiKey = '';
  activeTab: 'events' | 'send' = 'events';
  loading = false; sending = false; message = ''; messageType: 'success' | 'error' = 'success';
  filters = { status: '', idContrato: '', idTransacao: '' };
  payment = { id_transacao: '', id_contrato: '', valor: null as number | null,
    data_pagamento: new Date().toISOString().slice(0, 16), status: 'Pago' };
  events: PaymentEventLog[] = []; page = 1; pageSize = 10; totalItems = 0; totalPages = 0;

  ngOnInit(): void { const url = sessionStorage.getItem('payment-api-url'); if (url) this.apiUrl = url; }
  get configured(): boolean { return Boolean(this.apiUrl.trim() && this.apiKey.trim()); }
  get firstItem(): number { return this.totalItems ? (this.page - 1) * this.pageSize + 1 : 0; }
  get lastItem(): number { return Math.min(this.page * this.pageSize, this.totalItems); }

  loadEvents(page = 1): void {
    if (!this.configured) { this.showMessage('Informe a URL da API e a API key para consultar os eventos.', 'error'); return; }
    this.loading = true; this.message = ''; this.page = page;
    sessionStorage.setItem('payment-api-url', this.apiUrl.trim());
    let params = new HttpParams().set('page', page).set('pageSize', this.pageSize);
    if (this.filters.status) params = params.set('status', this.filters.status);
    if (this.filters.idContrato.trim()) params = params.set('idContrato', this.filters.idContrato.trim());
    if (this.filters.idTransacao.trim()) params = params.set('idTransacao', this.filters.idTransacao.trim());
    this.http.get<PagedResult<PaymentEventLog>>(`${this.normalizedApiUrl()}/api/payment-event-logs`, { headers: this.headers(), params }).subscribe({
      next: result => { this.events = result.items; this.totalItems = result.totalItems; this.totalPages = result.totalPages; this.loading = false; },
      error: error => { this.loading = false; this.showMessage(this.errorMessage(error), 'error'); }
    });
  }

  clearFilters(): void { this.filters = { status: '', idContrato: '', idTransacao: '' }; if (this.configured) this.loadEvents(1); }
  sendPayment(): void {
    if (!this.configured) { this.showMessage('Informe a URL da API e a API key antes de enviar.', 'error'); return; }
    this.sending = true; this.message = '';
    const payload = { ...this.payment, data_pagamento: new Date(this.payment.data_pagamento).toISOString() };
    this.http.post<{ eventId: number; processingStatus: string }>(`${this.normalizedApiUrl()}/webhooks/pagamento`, payload, { headers: this.headers() }).subscribe({
      next: response => { this.sending = false; this.showMessage(`Evento #${response.eventId} recebido e enviado para processamento.`, 'success'); this.activeTab = 'events'; this.loadEvents(1); },
      error: error => { this.sending = false; this.showMessage(this.errorMessage(error), 'error'); }
    });
  }
  statusClass(status: string): string { return `status-${status.toLowerCase()}`; }
  statusLabel(status: string): string { return ({ Pending: 'Pendente', Processing: 'Processando', Success: 'Sucesso', Error: 'Erro', Duplicate: 'Duplicado' } as Record<string,string>)[status] ?? status; }
  private normalizedApiUrl(): string { return this.apiUrl.trim().replace(/\/$/, ''); }
  private headers(): HttpHeaders { return new HttpHeaders({ 'X-Api-Key': this.apiKey.trim() }); }
  private showMessage(message: string, type: 'success' | 'error'): void { this.message = message; this.messageType = type; }
  private errorMessage(error: any): string {
    if (error.status === 0) return 'Não foi possível conectar à API. Verifique se o back-end está ativo e com CORS habilitado.';
    if (error.status === 401) return 'API key inválida ou não informada.';
    return error.error?.message || error.error?.errors?.join(' ') || `A API retornou o erro ${error.status}.`;
  }
}
