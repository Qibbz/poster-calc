import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Перевірка email
    if (!email || !email.endsWith('@joinposter.com')) {
      return NextResponse.json(
        { error: 'Невірний email' },
        { status: 401 }
      );
    }

    // Перевірка пароля з ENV
    if (password !== process.env.APP_PASSWORD) {
      return NextResponse.json(
        { error: 'Невірний пароль' },
        { status: 401 }
      );
    }

    // Створення сесії
    await createSession(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Помилка сервера' },
      { status: 500 }
    );
  }
}