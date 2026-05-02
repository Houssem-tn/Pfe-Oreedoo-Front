import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DpmRequest } from '../stock/stock.model';

const RED    = [229, 36, 59]  as [number, number, number];
const DARK   = [127, 18, 39]  as [number, number, number];
const GRAY   = [248, 248, 248] as [number, number, number];
const BORDER = [220, 220, 220] as [number, number, number];
const TEXT   = [30, 30, 30]   as [number, number, number];
const MUTED  = [120, 120, 120] as [number, number, number];

@Injectable({ providedIn: 'root' })
export class DpmPdfService {

  download(dpm: DpmRequest): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 0;

    // ── Header bar ──────────────────────────────────────────────────
    doc.setFillColor(...RED);
    doc.rect(0, 0, W, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('OOREDOO', 14, 14);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('DELIVERY ORDER — EQUIPMENT', W - 14, 14, { align: 'right' });
    y = 28;

    // ── DPM number + status strip ────────────────────────────────────
    doc.setFillColor(...GRAY);
    doc.roundedRect(14, y, W - 28, 18, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...DARK);
    doc.text(dpm.dpmNumber, 20, y + 11);

    const statusText = this.statusLabel(dpm.status);
    const statusColor = this.statusColor(dpm.status);
    doc.setFontSize(9);
    doc.setTextColor(...statusColor);
    doc.text(`● ${statusText}`, W - 20, y + 7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Created: ${this.fmt(dpm.createdAt)}`, W - 20, y + 13, { align: 'right' });
    if (dpm.confirmedAt) {
      doc.text(`Confirmed: ${this.fmt(dpm.confirmedAt)}`, W - 20, y + 18, { align: 'right' });
    }
    y += 24;

    // ── FROM / TO ────────────────────────────────────────────────────
    const colW = (W - 28 - 6) / 2;
    this.drawInfoBox(doc, 14, y, colW, 'FROM — Zone Manager', [
      ['Name', dpm.zmName],
      ['Email', dpm.zmEmail]
    ]);
    this.drawInfoBox(doc, 14 + colW + 6, y, colW, 'TO — Sub-Technical Team', [
      ['Name', dpm.sttName],
      ['Email', dpm.sttEmail]
    ]);
    y += 38;

    // ── Delivery person ──────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('DELIVERY PERSON', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(dpm.deliveryPersonName || '—', 14, y + 6);
    y += 16;

    // ── Items table ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('EQUIPMENT ITEMS', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Equipment', 'Requested', 'Confirmed', 'Shortage', 'Note']],
      body: dpm.items.map(item => [
        item.equipmentName,
        String(item.requestedQuantity),
        item.confirmedQuantity != null ? String(item.confirmedQuantity) : '—',
        item.shortageQuantity && item.shortageQuantity > 0 ? String(item.shortageQuantity) : '—',
        item.confirmationNote || '—'
      ]),
      headStyles: {
        fillColor: RED,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      alternateRowStyles: { fillColor: GRAY },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 'auto' }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.3
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Notes ────────────────────────────────────────────────────────
    if (dpm.notes?.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('NOTES', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(dpm.notes, W - 28);
      doc.text(lines, 14, y);
      y += (lines.length * 5) + 6;
    }

    // ── Signature section ────────────────────────────────────────────
    // Ensure enough space; add page if needed
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    const sigY = y + 4;
    const sigW = colW;

    // ZM signature box
    this.drawSignatureBox(doc, 14, sigY, sigW, 'Issued by — Zone Manager', dpm.zmName, this.fmt(dpm.createdAt));

    // STT signature box
    this.drawSignatureBox(doc, 14 + sigW + 6, sigY, sigW, 'Received by — STT', dpm.sttName,
      dpm.confirmedAt ? this.fmt(dpm.confirmedAt) : '_____ / _____ / _______');

    // ── Footer ───────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...RED);
      doc.rect(0, 290, W, 7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(`Ooredoo — ${dpm.dpmNumber}`, 14, 294.5);
      doc.text(`Generated on ${this.fmt(new Date().toISOString())} — Page ${i} / ${pageCount}`, W - 14, 294.5, { align: 'right' });
    }

    doc.save(`${dpm.dpmNumber}.pdf`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private drawInfoBox(
    doc: jsPDF, x: number, y: number, w: number,
    title: string, rows: [string, string][]
  ): void {
    doc.setFillColor(...GRAY);
    doc.roundedRect(x, y, w, 34, 2, 2, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 34, 2, 2, 'S');

    doc.setFillColor(...RED);
    doc.roundedRect(x, y, w, 8, 2, 2, 'F');
    doc.rect(x, y + 4, w, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + 4, y + 5.5);

    let ry = y + 13;
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label, x + 4, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(doc.splitTextToSize(value || '—', w - 8)[0], x + 4, ry + 5);
      ry += 12;
    }
  }

  private drawSignatureBox(
    doc: jsPDF, x: number, y: number, w: number,
    title: string, name: string, date: string
  ): void {
    doc.setFillColor(...GRAY);
    doc.roundedRect(x, y, w, 44, 2, 2, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 44, 2, 2, 'S');

    doc.setFillColor(...DARK);
    doc.roundedRect(x, y, w, 8, 2, 2, 'F');
    doc.rect(x, y + 4, w, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('Full Name:', x + 4, y + 15);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'bold');
    doc.text(name, x + 4, y + 21);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text('Date:', x + 4, y + 28);
    doc.setTextColor(...TEXT);
    doc.text(date, x + 4, y + 34);

    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text('Signature:', x + 4, y + 39);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(x + 22, y + 39, x + w - 6, y + 39);
  }

  private fmt(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private statusLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING_STT_CONFIRMATION: 'Pending Confirmation',
      PARTIALLY_CONFIRMED: 'Partially Confirmed',
      FULLY_CONFIRMED: 'Fully Confirmed',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }

  private statusColor(s: string): [number, number, number] {
    if (s === 'FULLY_CONFIRMED')   return [22, 101, 52];
    if (s === 'PARTIALLY_CONFIRMED') return [146, 64, 14];
    if (s === 'REJECTED')          return [185, 28, 28];
    if (s === 'CANCELLED')         return [100, 116, 139];
    return [30, 64, 175];
  }
}
