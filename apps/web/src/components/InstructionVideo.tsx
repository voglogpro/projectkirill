import { useEffect, useRef, useState } from "react";
import { Play, Rocket } from "lucide-react";
import "../instruction-video.css";

/** Silent demonstration with explicit pause and reduced-motion support. */
export function InstructionVideo({ id }: { id?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(false);
  const tall = useTallFrame();

  useEffect(() => {
    const element = video.current;
    if (element === null) return;
    element.muted = true; // React does not reflect the attribute, and autoplay needs it
    if (paused) { element.pause(); return; }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) void element.play().catch(() => { /* the poster stays */ });
        else element.pause();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [paused, tall]);

  return <figure id={id} className={`instruction-video build-loop ${tall ? "tall" : ""}`}>
    <figcaption className="loop-title"><i />КАК ЭТО РАБОТАЕТ<em>21 секунда</em><button type="button" className="loop-toggle" onClick={() => { setPaused(playing); if (playing) video.current?.pause(); else void video.current?.play().catch(() => { /* Allow another explicit attempt. */ }); }} aria-label={playing ? "Приостановить видео" : "Воспроизвести видео"}>{playing ? "Пауза" : "Смотреть"}</button></figcaption>
    <span className="loop-glow" aria-hidden="true" />
    <div className="instruction-video-stage"><video
      // A 16:9 frame on a phone is a stamp. The same story is cut 4:5 for
      // narrow screens, and the key forces a real reload when that flips.
      key={tall ? "tall" : "wide"}
      ref={video}
      poster={tall ? "/media/kira-build-tall-poster.jpg" : "/media/kira-build-poster.jpg"}
      muted
      loop
      playsInline
      autoPlay={!paused}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      preload="metadata"
      aria-label="Как в KIRA собирается бот и Mini App"
    >
      <source src={tall ? "/media/kira-build-tall.webm" : "/media/kira-build.webm"} type="video/webm" />
      <source src={tall ? "/media/kira-build-tall.mp4" : "/media/kira-build.mp4"} type="video/mp4" />
    </video>{!playing && <button type="button" className="instruction-video-play" onClick={() => { setPaused(false); void video.current?.play().catch(() => { /* Keep the poster and retry control visible. */ }); }} aria-label="Смотреть видеоинструкцию"><Play size={28} fill="currentColor" /><span>Смотреть инструкцию<small>21 секунда</small></span></button>}</div>
    <p className="loop-steps"><Rocket size={14} /> Выберите основу → настройте → запустите</p>
  </figure>;
}

/** Below this width the wide cut is unreadable, so the tall one plays instead. */
function useTallFrame(): boolean {
  const query = "(max-width: 720px)";
  const [tall, setTall] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const sync = () => setTall(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return tall;
}
