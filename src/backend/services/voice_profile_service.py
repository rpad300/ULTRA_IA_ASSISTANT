import logging
import asyncio
import struct
import pveagle
from typing import List, Optional, Dict, Any, Tuple
from config import PICOVOICE_API_KEY
from db.supabase_client import get_async_supabase_client
import base64

logger = logging.getLogger(__name__)

class VoiceProfileService:
    """
    SOTA Voice Profile Service.
    Handles high-precision biometric enrollment with real-time feedback.
    """
    
    def __init__(self):
        self.access_key = PICOVOICE_API_KEY
        if not self.access_key:
            logger.warning("❌ PICOVOICE_API_KEY missing. Biometrics will be unavailable.")

    async def enroll_contact_voice(self, contact_id: str, audio_data: bytes) -> Tuple[bool, str]:
        """
        SOTA Enrollment: Processa o áudio em threads separadas (CPU intensivo) e fornece feedback detalhado.
        Retorna (sucesso, mensagem/feedback).
        """
        if not self.access_key:
            return False, "API Key não configurada."

        # Offload para thread pool para não bloquear o Event Loop
        return await asyncio.to_thread(self._sync_enroll, contact_id, audio_data)

    def _sync_enroll(self, contact_id: str, audio_data: bytes) -> Tuple[bool, str]:
        """Lógica síncrona de processamento Eagle."""
        profiler = None
        try:
            profiler = pveagle.create_profiler(access_key=self.access_key)
            
            # Normalização de bytes para PCM16
            if len(audio_data) % 2 != 0:
                audio_data = audio_data[:-1]
            
            pcm = struct.unpack(f"{len(audio_data)//2}h", audio_data)
            
            # O Eagle exige frames específicos. Vamos usar o valor recomendado pelo SDK.
            try:
                # Assuming min_enroll_samples exists in pveagle 2.0+
                frame_length = profiler.min_enroll_samples
            except:
                frame_length = 512 # Fallback sane default

            percentage = 0.0
            feedback_counts = {}

            for i in range(0, len(pcm) - frame_length + 1, frame_length):
                frame = pcm[i : i + frame_length]
                percentage, feedback = profiler.enroll(frame)
                
                # Colecionar feedback para ajudar o utilizador
                if feedback != pveagle.EagleProfilerEnrollFeedback.NONE:
                    fb_name = feedback.name
                    feedback_counts[fb_name] = feedback_counts.get(fb_name, 0) + 1
                
                if percentage >= 100.0:
                    break

            if percentage < 100.0:
                # Gerar mensagem de erro baseada no feedback mais frequente
                top_feedback = max(feedback_counts, key=feedback_counts.get) if feedback_counts else "Áudio insuficiente"
                logger.warning(f"Voice enrollment failed for {contact_id}: {percentage:.1f}% - {top_feedback}")
                return False, f"Registo incompleto ({percentage:.1f}%). Problema: {top_feedback}"

            # Exportar e Salvar
            profile = profiler.export()
            self._save_profile_to_db(contact_id, profile)
            return True, "Perfil biométrico criado com sucesso."

        except Exception as e:
            logger.error(f"❌ Eagle Enrollment Error for {contact_id}: {e}")
            return False, str(e)
        finally:
            if profiler:
                profiler.delete()

    def _save_profile_to_db(self, contact_id: str, profile: pveagle.EagleProfile):
        """Persistência robusta via Supabase."""
        # IMPORTANTE: Usamos o cliente síncrono aqui apenas se estivermos dentro do to_thread
        # Caso contrário, injetamos o cliente assíncrono.
        from db.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        profile_bytes = profile.to_bytes()
        # SOTA: Guardar como Hex para compatibilidade total com Postgres bytea
        supabase.table("contacts").update({
            "voice_profile": profile_bytes.hex(),
            "last_enrollment": "now()"
        }).eq("id", contact_id).execute()
        logger.info(f"💾 Voice Profile persisted for {contact_id}")

    async def get_all_profiles(self) -> Dict[str, bytes]:
        """Recupera perfis para o 'Hot Path' (Memória)."""
        try:
            supabase = await get_async_supabase_client()
            # Filtramos apenas contactos que têm perfil
            res = await supabase.table("contacts").select("id, voice_profile").not_.is_("voice_profile", "null").execute()
            
            profiles = {}
            for row in res.data:
                raw_hex = row.get("voice_profile")
                if raw_hex:
                    # Lidar com prefixos do Postgres se necessário
                    if raw_hex.startswith('\\x'): raw_hex = raw_hex[2:]
                    try:
                        profiles[row["id"]] = bytes.fromhex(raw_hex)
                    except Exception as hex_err:
                        logger.warning(f"Failed to load profile for {row['id']}: {hex_err}")
            
            logger.info(f"Loaded {len(profiles)} biometric profiles into memory.")
            return profiles
        except Exception as e:
            logger.error(f"❌ Failed to fetch profiles: {e}")
            return {}

# Singleton
_service = None
def get_voice_profile_service():
    global _service
    if _service is None:
        _service = VoiceProfileService()
    return _service
