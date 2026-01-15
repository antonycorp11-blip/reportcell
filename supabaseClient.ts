
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wayigtlilhvutbfvxgae.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheWlndGxpbGh2dXRiZnZ4Z2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDUwODQsImV4cCI6MjA4NDA4MTA4NH0.T26a6WAF4R7UlxN8lRHqoh_QEpc3SZqa97NhOlXQfbI';

export const supabase = createClient(supabaseUrl, supabaseKey);
