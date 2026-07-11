import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { NotificationStoreService } from './notification-store.service';
import { NotificationApiService } from './notification-api.service';
import { NotificationWsService } from './notification-ws.service';
import { AuthStore } from '../auth/auth.store';
import { NotificationItem } from './models/notification.model';

describe('NotificationStoreService', () => {
  let store: NotificationStoreService;
  let authStore: AuthStore;
  let apiSpy: jasmine.SpyObj<NotificationApiService>;
  let wsSpy: jasmine.SpyObj<NotificationWsService>;
  let wsIncoming: Subject<NotificationItem>;

  function item(overrides: Partial<NotificationItem>): NotificationItem {
    return {
      id: 'n-1',
      eventType: 'CASE_ASSIGNED_TO_TECH',
      title: 'Title',
      message: 'Message',
      targetRole: 'ROLE_TECH',
      read: false,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    wsIncoming = new Subject<NotificationItem>();
    apiSpy = jasmine.createSpyObj('NotificationApiService', ['getMyRoleNotifications', 'markAsRead', 'markAllAsRead']);
    wsSpy = jasmine.createSpyObj('NotificationWsService', ['connect', 'disconnect']);
    (wsSpy as any).notifications$ = wsIncoming.asObservable();

    apiSpy.getMyRoleNotifications.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationApiService, useValue: apiSpy },
        { provide: NotificationWsService, useValue: wsSpy },
      ],
    });

    store = TestBed.inject(NotificationStoreService);
    authStore = TestBed.inject(AuthStore);
  });

  it('init() should do nothing when the user is not authenticated', () => {
    store.init();

    expect(wsSpy.connect).not.toHaveBeenCalled();
    expect(apiSpy.getMyRoleNotifications).not.toHaveBeenCalled();
    expect(store.initialized()).toBeFalse();
  });

  it('init() should connect the WS and load the initial list once authenticated', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(of([item({ id: 'n-1' })]));

    store.init();

    expect(wsSpy.connect).toHaveBeenCalled();
    expect(store.items().length).toBe(1);
    expect(store.initialized()).toBeTrue();
  });

  it('init() should be idempotent (a second call does not reconnect)', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    store.init();
    store.init();

    expect(wsSpy.connect).toHaveBeenCalledTimes(1);
    expect(apiSpy.getMyRoleNotifications).toHaveBeenCalledTimes(1);
  });

  it('unreadCount should reflect only unread items', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(of([
      item({ id: 'n-1', read: false }),
      item({ id: 'n-2', read: true }),
      item({ id: 'n-3', read: false }),
    ]));

    store.init();

    expect(store.unreadCount()).toBe(2);
  });

  it('markAsRead() should update the matching item in place after the API call resolves', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(of([item({ id: 'n-1', read: false })]));
    store.init();

    apiSpy.markAsRead.and.returnValue(of(item({ id: 'n-1', read: true })));
    store.markAsRead('n-1');

    expect(store.unreadCount()).toBe(0);
  });

  it('markAsRead() should not call the API for an already-read notification', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(of([item({ id: 'n-1', read: true })]));
    store.init();

    store.markAsRead('n-1');

    expect(apiSpy.markAsRead).not.toHaveBeenCalled();
  });

  it('a realtime CRITICAL/operational alert should be added to items AND pushed as an ephemeral alert', () => {
    authStore.setUser({ email: 'zm@example.com', role: 'ROLE_ZM' } as any);
    store.init();

    wsIncoming.next(item({ id: 'n-critical', eventType: 'SLA_BREACHED', level: 'CRITICAL' }));

    expect(store.items().some(n => n.id === 'n-critical')).toBeTrue();
    expect(store.ephemeralAlerts().some(n => n.id === 'n-critical')).toBeTrue();
  });

  it('a realtime plain INFO notification should be added to items but NOT shown as a popup', () => {
    authStore.setUser({ email: 'zm@example.com', role: 'ROLE_ZM' } as any);
    store.init();

    wsIncoming.next(item({ id: 'n-info', eventType: 'USER_REGISTERED', level: 'INFO' }));

    expect(store.items().some(n => n.id === 'n-info')).toBeTrue();
    expect(store.ephemeralAlerts().some(n => n.id === 'n-info')).toBeFalse();
  });

  it('destroy() should disconnect the WS and reset items/initialized state', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(of([item({ id: 'n-1' })]));
    store.init();

    store.destroy();

    expect(wsSpy.disconnect).toHaveBeenCalled();
    expect(store.items()).toEqual([]);
    expect(store.initialized()).toBeFalse();
  });

  it('init() should not throw and should clear loading when the initial load fails', () => {
    authStore.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);
    apiSpy.getMyRoleNotifications.and.returnValue(throwError(() => new Error('network error')));

    expect(() => store.init()).not.toThrow();
    expect(store.loading()).toBeFalse();
  });
});
