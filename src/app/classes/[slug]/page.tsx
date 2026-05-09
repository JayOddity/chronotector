import { notFound } from 'next/navigation';
import { classes, getClassBySlug } from '@/data/classes';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema } from '@/lib/schema';
import ClassPageGame from '@/components/ClassPageGame';

export function generateStaticParams() {
  return classes.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cls = getClassBySlug(slug);
  if (!cls) return {};
  return pageMetadata({
    title: cls.name,
    description: cls.description,
    path: `/classes/${cls.slug}`,
  });
}

export default async function ClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cls = getClassBySlug(slug);
  if (!cls) notFound();

  const otherClasses = classes.filter((c) => c.slug !== slug);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Classes', path: '/classes' },
          { name: cls.name, path: `/classes/${cls.slug}` },
        ])}
      />
      <ClassPageGame cls={cls} otherClasses={otherClasses} />
    </>
  );
}
