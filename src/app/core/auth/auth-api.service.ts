import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthResponse } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly API = 'http://localhost:8080/api/v1/auth';

  constructor(private http: HttpClient) {}

  register(body: { fullName: string; email: string; password: string; role?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, body);
  }

  login(body: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, body);
  }
}