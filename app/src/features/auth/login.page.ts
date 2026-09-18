import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FileMakerService } from '../../core/services/filemaker.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private fm: FileMakerService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const { username, password } = this.form.value as { username: string; password: string };
    this.fm.login(username.trim(), password).subscribe({
      next: () => {
        this.loading = false;
        this.cdr.markForCheck();
        this.router.navigateByUrl('/home');
      },
      error: err => {
        this.loading = false;
        const msg = err?.error?.messages?.[0]?.message;
        const code = err?.error?.messages?.[0]?.code;
        if (code === '212' || err?.status === 401) this.error = 'Usuario o contraseña incorrectos';
        else if (err?.status === 0) this.error = 'Sin conexión con el servidor (fmsuit.cat). Reintenta.';
        else this.error = msg ?? err?.message ?? 'Error de login';
        this.cdr.markForCheck();
      },
    });
  }
}

