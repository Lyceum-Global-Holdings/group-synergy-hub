import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROOM_COLORS: Record<string, string> = {
  bedroom: '#3B82F6',
  bathroom: '#06B6D4',
  kitchen: '#F59E0B',
  living: '#10B981',
  dining: '#8B5CF6',
  office: '#EC4899',
  garage: '#6B7280',
  storage: '#78716C',
  laundry: '#14B8A6',
  balcony: '#84CC16',
  hallway: '#A3A3A3',
  closet: '#D4D4D4',
  default: '#6366F1',
};

// Retry logic with exponential backoff for transient errors
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AI API request attempt ${attempt}/${maxRetries}`);
      
      // Create abort controller with 30s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // If success or non-retryable error, return immediately
      if (response.ok || ![502, 503, 504].includes(response.status)) {
        return response;
      }
      
      // Retryable error - log and prepare for retry
      const errorText = await response.text();
      console.log(`AI API error: ${response.status} ${errorText}`);
      lastError = new Error(`HTTP ${response.status}: ${errorText}`);
      
    } catch (error) {
      console.log(`Request failed: ${(error as Error).message}`);
      lastError = error as Error;
      
      // Don't retry on abort (timeout)
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
    }
    
    // Wait before next retry (exponential backoff: 1s, 2s, 4s)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, totalAreaSqm } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing floor plan image:', imageUrl.substring(0, 100) + '...');

    const systemPrompt = `You are an expert architect and floor plan analyst. Analyze floor plan images to identify rooms, their types, and estimate their positions and areas.

When analyzing a floor plan:
1. Identify each distinct room or space
2. Determine the room type (bedroom, bathroom, kitchen, living, dining, office, garage, storage, laundry, balcony, hallway, closet)
3. Estimate the center position of each room as a percentage (0-100) of the total image width and height
4. Estimate the width and height of each room as a percentage of the total image
5. If total area is provided, calculate individual room areas proportionally

Be thorough and identify ALL visible rooms including hallways, closets, and utility spaces.`;

    const userPrompt = totalAreaSqm 
      ? `Analyze this floor plan image. The total floor area is ${totalAreaSqm} square meters. Identify all rooms with their positions and calculate their areas based on their proportional sizes.`
      : `Analyze this floor plan image. Identify all rooms with their positions. Estimate relative sizes as percentages.`;

    const response = await fetchWithRetry('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_detected_rooms',
              description: 'Report all detected rooms from the floor plan analysis',
              parameters: {
                type: 'object',
                properties: {
                  rooms: {
                    type: 'array',
                    description: 'List of detected rooms',
                    items: {
                      type: 'object',
                      properties: {
                        room_name: {
                          type: 'string',
                          description: 'Descriptive name for the room (e.g., "Master Bedroom", "Kitchen", "Bathroom 1")'
                        },
                        room_type: {
                          type: 'string',
                          enum: ['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'office', 'garage', 'storage', 'laundry', 'balcony', 'hallway', 'closet'],
                          description: 'Type/category of the room'
                        },
                        center_x: {
                          type: 'number',
                          description: 'X position of room center as percentage (0-100) from left edge'
                        },
                        center_y: {
                          type: 'number',
                          description: 'Y position of room center as percentage (0-100) from top edge'
                        },
                        width_percent: {
                          type: 'number',
                          description: 'Width of room as percentage (0-100) of total image width'
                        },
                        height_percent: {
                          type: 'number',
                          description: 'Height of room as percentage (0-100) of total image height'
                        },
                        area_percentage: {
                          type: 'number',
                          description: 'Estimated area as percentage of total floor area'
                        }
                      },
                      required: ['room_name', 'room_type', 'center_x', 'center_y', 'width_percent', 'height_percent', 'area_percentage']
                    }
                  },
                  total_rooms_detected: {
                    type: 'number',
                    description: 'Total number of rooms detected'
                  }
                },
                required: ['rooms', 'total_rooms_detected']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'report_detected_rooms' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to analyze floor plan. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract tool call results
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'report_detected_rooms') {
      console.error('Unexpected AI response format:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Failed to parse room detection results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detectionResult = JSON.parse(toolCall.function.arguments);
    
    // Process rooms and add colors and calculated areas
    const processedRooms = detectionResult.rooms.map((room: any) => {
      const areaSqm = totalAreaSqm ? (room.area_percentage / 100) * totalAreaSqm : null;
      const areaSqft = areaSqm ? areaSqm * 10.764 : null;
      
      return {
        room_name: room.room_name,
        room_type: room.room_type,
        center_x: Math.round(room.center_x * 100) / 100,
        center_y: Math.round(room.center_y * 100) / 100,
        width_percent: Math.round(room.width_percent * 100) / 100,
        height_percent: Math.round(room.height_percent * 100) / 100,
        area_sqm: areaSqm ? Math.round(areaSqm * 100) / 100 : null,
        area_sqft: areaSqft ? Math.round(areaSqft * 100) / 100 : null,
        color: ROOM_COLORS[room.room_type] || ROOM_COLORS.default,
      };
    });

    console.log(`Detected ${processedRooms.length} rooms`);

    return new Response(
      JSON.stringify({ 
        success: true,
        rooms: processedRooms,
        total_rooms: detectionResult.total_rooms_detected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-floor-plan:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTransient = errorMessage.includes('503') || errorMessage.includes('502') || errorMessage.includes('timed out');
    
    return new Response(
      JSON.stringify({ 
        error: isTransient 
          ? 'AI service temporarily unavailable. Please try again in a moment.' 
          : errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
