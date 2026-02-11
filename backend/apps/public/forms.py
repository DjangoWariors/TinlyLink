from django import forms


class ContactForm(forms.Form):
    name = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            "placeholder": "Your name",
            "class": "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm",
        }),
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "you@example.com",
            "class": "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm",
        }),
    )
    subject = forms.ChoiceField(
        choices=[
            ("", "Select a topic"),
            ("general", "General inquiry"),
            ("support", "Technical support"),
            ("billing", "Billing question"),
            ("bug", "Report a bug"),
            ("feature", "Feature request"),
            ("other", "Other"),
        ],
        widget=forms.Select(attrs={
            "class": "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm bg-white",
        }),
    )
    message = forms.CharField(
        max_length=5000,
        widget=forms.Textarea(attrs={
            "placeholder": "How can we help?",
            "rows": 6,
            "class": "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm resize-y",
        }),
    )
