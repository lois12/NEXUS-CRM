import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { ContentPost, SocialPlatform, ContentStatus } from '../../types';

const platformColors: Record<SocialPlatform, string> = {
  telegram: '#0088cc',
  vk: '#0077ff',
  site: '#00ff88',
  max: '#ff6600',
};

const statusColors: Record<ContentStatus, string> = {
  черновик: '#6b7280',
  запланирован: '#eab308',
  на_доработку: '#ff3b30',
  согласован: '#00d4ff',
  утверждён: '#bf00ff',
  опубликован: '#22c55e',
};

interface FullCalendarViewProps {
  posts: ContentPost[];
  filterPlatform: SocialPlatform | 'all';
  onDateClick: (date: Date) => void;
  onEventClick: (post: ContentPost) => void;
  onEventDrop: (postId: string, newDate: Date) => void;
}

export default function FullCalendarView({
  posts,
  filterPlatform,
  onDateClick,
  onEventClick,
  onEventDrop,
}: FullCalendarViewProps) {

  const events = useMemo(() => {
    return posts
      .filter(p => filterPlatform === 'all' || p.platform === filterPlatform)
      .filter(p => p.scheduledDate || p.createdAt)
      .map(post => {
        const dateStr = post.scheduledDate || post.createdAt;
        const color = platformColors[post.platform] || '#6b7280';
        const statusColor = statusColors[post.status] || '#6b7280';
        const platformLabel = post.platform.toUpperCase();

        return {
          id: post.id,
          title: `[${platformLabel}] ${post.title}`,
          start: dateStr,
          allDay: !post.scheduledDate?.includes('T'),
          backgroundColor: `${color}25`,
          borderColor: `${color}60`,
          textColor: color,
          extendedProps: {
            post,
            statusColor,
            platformColor: color,
          },
        };
      });
  }, [posts, filterPlatform]);

  return (
    <div className="nexus-fullcalendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        locale="ru"
        firstDay={1}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        buttonText={{
          today: 'СЕГОДНЯ',
          month: 'МЕСЯЦ',
          week: 'НЕДЕЛЯ',
          day: 'ДЕНЬ',
          list: 'СПИСОК',
        }}
        height="auto"
        dayMaxEvents={3}
        moreLinkText="+ ещё"
        events={events}
        dateClick={(arg: any) => onDateClick(new Date(arg.date))}
        eventClick={(arg: any) => {
          const post = arg.event.extendedProps?.post as ContentPost;
          if (post) onEventClick(post);
        }}
        editable={true}
        eventDrop={(arg: any) => {
          const postId = arg.event.id;
          const newDate = arg.event.start;
          if (postId && newDate) onEventDrop(postId, newDate);
          else arg.revert();
        }}
        eventDisplay="block"
        displayEventEnd={false}
        nowIndicator={true}
        weekNumbers={false}
        navLinks={true}
        dayHeaderFormat={{ weekday: 'short' }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        eventContent={(arg: any) => {
          const props = arg.event.extendedProps;
          const post = props?.post as ContentPost | undefined;
          const statusDot = props?.statusColor || '#6b7280';

          if (!post) return null;

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', padding: '2px 4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: statusDot, boxShadow: `0 0 4px ${statusDot}` }} />
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, opacity: 0.6, flexShrink: 0 }}>
                {post.platform.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {post.title}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
}
