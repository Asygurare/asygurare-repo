import { supabaseClient } from '@/src/lib/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
/**
 * Auth Service
 * 
 * Centralized service for authentication operations including
 * sign out, password changes, and account deletion.
 */

export interface AuthServiceResult {
  success: boolean;
  error?: string;
}

/**
 * Signs out the current user and clears local storage
 * @returns Promise<AuthServiceResult>
 */
export async function signOutUser(): Promise<AuthServiceResult> {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Clear local storage and session storage
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }

    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al cerrar sesión'
    };
  }
}

/**
 * Changes the current user's password
 * @param currentPassword - Current password for verification
 * @param newPassword - New password to set
 * @returns Promise<AuthServiceResult>
 */
export async function changeUserPassword(
  currentPassword: string, 
  newPassword: string
): Promise<AuthServiceResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'No se pudo verificar el usuario actual'
      };
    }

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (verifyError) {
      return {
        success: false,
        error: 'La contraseña actual es incorrecta'
      };
    }

    // Update password
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      if(updateError.code === 'same_password') {
        return {
          success: false,
          error: 'La nueva contraseña no puede ser la misma que la actual'
        };
      }
      return {
        success: false,
        error: updateError.message
      };
    }

    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al cambiar la contraseña'
    };
  }
}

/**
 * Manually clears Supabase auth tokens without calling signOut API
 * This preserves the current session for one final RPC call
 */
function clearAuthTokensManually(): void {
  if (typeof window === 'undefined') return;

  try {
    // Get the Supabase project reference from the URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl?.split('//')[1]?.split('.')[0] || '';

    // Clear Supabase auth tokens from localStorage
    const authTokenKey = `sb-${projectRef}-auth-token`;
    localStorage.removeItem(authTokenKey);
    
    // Clear other potential Supabase keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });

    // Clear session storage
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') && key.includes('auth')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing auth tokens manually:', error);
  }
}

/**
 * Deletes the current user account and all associated data
 * This requires the RPC function 'delete_user_account' to be created in Supabase
 * @returns Promise<AuthServiceResult>
 */
export async function deleteUserAccount(): Promise<AuthServiceResult> {
  try {
    // Step 1: Call the RPC function to delete user account (while still authenticated)
    console.log('Calling delete_user_account RPC function...');
    const { error } = await supabaseClient.rpc('delete_user_account');

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Step 2: Manually clear auth tokens (without calling signOut API)
    console.log('Manually clearing auth tokens...');
    clearAuthTokensManually();

    // Step 3: Attempt to clean up server-side session (may fail since user is deleted)
    console.log('Attempting to clean up server-side session...');
    try {
      await supabaseClient.auth.signOut();
      console.log('Server-side session cleaned up');
    } catch (signOutError: any) {
      // This is expected - user account was deleted, so signOut will fail
      console.log('SignOut failed (expected after account deletion):', signOutError.message);
    }

    console.log('Account deletion completed successfully');
    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al eliminar la cuenta'
    };
  }
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePassword(password: string): { 
  isValid: boolean; 
  message?: string 
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'La contraseña debe tener al menos 8 caracteres'
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      message: 'La contraseña no puede tener más de 128 caracteres'
    };
  }

  // Additional password strength checks can be added here
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return {
      isValid: false,
      message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    };
  }

  return {
    isValid: true
  };
}

/**
 * Helper function to handle auth errors consistently
 * @param error - Auth error from Supabase
 * @returns User-friendly error message
 */
export function getAuthErrorMessage(error: AuthError | Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Credenciales incorrectas';
  }

  if (message.includes('email not confirmed')) {
    return 'Por favor confirma tu correo electrónico';
  }

  if (message.includes('too many requests')) {
    return 'Demasiados intentos. Intenta de nuevo más tarde';
  }

  if (message.includes('weak password')) {
    return 'La contraseña es muy débil';
  }

  return error.message || 'Error desconocido';
} 