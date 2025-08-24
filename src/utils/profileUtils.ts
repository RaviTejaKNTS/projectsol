import { supabase } from '../lib/supabaseClient';
import type { UUID } from '../types/db';

/**
 * Ensures a profile exists for the given user ID
 * This is a fallback function in case the auth triggers don't work
 */
export async function ensureProfileExists(userId: UUID, userMetadata?: any): Promise<void> {
  try {
    console.log('Checking if profile exists for user:', userId);
    
    // First check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking for existing profile:', checkError);
      throw checkError;
    }
    
    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return;
    }
    
    console.log('Profile does not exist, creating one...');
    
    // Create the profile
    const profileData = {
      id: userId,
      display_name: userMetadata?.name || userMetadata?.email?.split('@')[0] || 'User',
      avatar_url: userMetadata?.avatar_url || null,
    };
    
    const { error: insertError } = await supabase
      .from('profiles')
      .insert(profileData);
    
    if (insertError) {
      console.error('Error creating profile:', insertError);
      throw insertError;
    }
    
    console.log('Profile created successfully for user:', userId);
  } catch (error) {
    console.error('ensureProfileExists failed:', error);
    throw error;
  }
}

/**
 * Force creates a profile, useful for recovery scenarios
 */
export async function forceCreateProfile(userId: UUID, displayName?: string, avatarUrl?: string): Promise<void> {
  try {
    const profileData = {
      id: userId,
      display_name: displayName || 'User',
      avatar_url: avatarUrl || null,
    };
    
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });
    
    if (error) {
      console.error('Error force creating profile:', error);
      throw error;
    }
    
    console.log('Profile force created/updated for user:', userId);
  } catch (error) {
    console.error('forceCreateProfile failed:', error);
    throw error;
  }
}
